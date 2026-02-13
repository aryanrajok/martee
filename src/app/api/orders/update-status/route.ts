import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Function to notify WooCommerce that payment is confirmed
async function notifyWooCommercePayment(orderKey: string, transactionId: string, apiKey: string, siteUrl?: string) {
  console.log(orderKey, transactionId, apiKey ? `API Key: ${apiKey.slice(0, 4)}...` : 'No API Key')
  
  // Use the site URL if provided, otherwise fall back to default
  const wooCommerceUrl = siteUrl || 'http://kaia-commerce2.local';
  
  try {
    const response = await fetch(`${wooCommerceUrl}/wp-admin/admin-ajax.php?action=krw_payment_confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        order_key: orderKey,
        transaction_id: transactionId,
        api_key: apiKey
      })
    });

    const result = await response.json();
    console.log('WooCommerce payment notification result:', result);
    return true;
  } catch (error) {
    console.error('Failed to notify WooCommerce:', error);
    return false;
  }
}

// Function to mark Shopify order as paid
async function markShopifyOrderAsPaid(adminGraphqlApiId: string, shopDomain?: string, merchantWallet?: string) {
  let shopifyAccessToken = process.env.SHOPIFY_API_ACCESS_TOKEN;
  let finalShopDomain = shopDomain || process.env.SHOPIFY_SHOP_DOMAIN;
  
  // If merchantWallet is provided, try to get merchant-specific credentials
  if (merchantWallet) {
    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: merchantWallet.toLowerCase() }
    });
    
    if (merchant?.shopifyAccessToken) {
      shopifyAccessToken = merchant.shopifyAccessToken;
      finalShopDomain = merchant.shopifyShopDomain || finalShopDomain;
    }
  }
  
  if (!shopifyAccessToken) {
    console.error('No Shopify access token found for this merchant');
    return false;
  }

  if (!finalShopDomain) {
    console.error('Shop domain not found for this merchant');
    return false;
  }

  const mutation = `
    mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
      orderMarkAsPaid(input: $input) {
        userErrors {
          field
          message
        }
        order {
          id
          name
          canMarkAsPaid
          displayFinancialStatus
          totalPrice
          totalOutstandingSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          transactions(first: 10) {
            id
            kind
            status
            amountSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            gateway
            createdAt
          }
        }
      }
    }
  `;

  const variables = {
    input: {
      id: adminGraphqlApiId
    }
  };

  try {
    const response = await fetch(`https://${finalShopDomain}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAccessToken,
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('Shopify GraphQL errors:', result.errors);
      return false;
    }

    if (result.data?.orderMarkAsPaid?.userErrors?.length > 0) {
      console.error('Shopify order mark as paid errors:', result.data.orderMarkAsPaid.userErrors);
      return false;
    }

    console.log('Successfully marked Shopify order as paid:', result.data?.orderMarkAsPaid?.order?.name);
    return true;
  } catch (error) {
    console.error('Failed to mark Shopify order as paid:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status, transferHash, customerWallet, apiKey } = body;
    
    // Check for API key in header or body (for WooCommerce)
    const headerApiKey = request.headers.get('X-API-Key');
    const authApiKey = headerApiKey || apiKey;

    if (!orderId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch the order first to check its type
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // If an API key is provided, validate it (for WooCommerce plugin updates)
    if (authApiKey) {
      // Validate the API key belongs to a merchant
      const merchant = await prisma.merchant.findUnique({
        where: { apiKey: authApiKey }
      });

      if (!merchant) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }

      // Verify the merchant owns this order by checking merchantWallet
      if (existingOrder.merchantWallet && existingOrder.merchantWallet !== merchant.walletAddress) {
        return NextResponse.json({ error: 'Unauthorized: Order does not belong to this merchant' }, { status: 403 });
      }
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: status,
        transferHash: transferHash || null,
        customerWallet: customerWallet || null,
        paidAt: status === 'PAID' ? new Date() : undefined,
      }
    });

    // If this is a Shopify order being marked as paid, notify Shopify
    if (status === 'PAID' && order.type === 'SHOPIFY' && order.adminGraphqlApiId) {
      console.log('Marking Shopify order as paid:', order.adminGraphqlApiId);
      const shopifySuccess = await markShopifyOrderAsPaid(
        order.adminGraphqlApiId, 
        order.shopDomain || undefined,
        order.merchantWallet || undefined
      );
      
      if (!shopifySuccess) {
        console.warn('Failed to mark Shopify order as paid, but continuing with local update');
      }
    }

    // If this is a WooCommerce order being marked as paid, notify WooCommerce
    if (status === 'PAID' && order.type === 'WOOCOMMERCE' && transferHash) {
      console.log('Notifying WooCommerce of payment confirmation:', order.id);
      
      // Always fetch the merchant's actual API key and site URL from database for WooCommerce notification
      let merchantApiKey: string | undefined;
      let siteUrl: string | undefined;
      
      if (order.merchantWallet) {
        console.log('Looking for merchant with wallet address:', order.merchantWallet);
        const merchant = await prisma.merchant.findUnique({
          where: { walletAddress: order.merchantWallet },
          select: { apiKey: true, wooCommerceSiteURL: true, walletAddress: true }
        });
        
        if (merchant) {
          merchantApiKey = merchant.apiKey;
          siteUrl = merchant.wooCommerceSiteURL || undefined;
          console.log('Found merchant:', {
            walletAddress: merchant.walletAddress,
            apiKey: merchantApiKey,
            siteUrl: siteUrl
          });
        } else {
          console.warn('No merchant found with wallet address:', order.merchantWallet);
        }
      } else {
        console.warn('No merchant wallet address on order');
      }
      
      if (merchantApiKey) {
        const wooCommerceSuccess = await notifyWooCommercePayment(order.id, transferHash, merchantApiKey, siteUrl);
        
        if (!wooCommerceSuccess) {
          console.warn('Failed to notify WooCommerce of payment, but continuing with local update');
        }
      } else {
        console.warn('No API key found for WooCommerce notification');
      }
    }

    return NextResponse.json({ success: true, order }, { status: 200 });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}