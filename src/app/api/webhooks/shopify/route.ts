import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// import crypto from 'crypto';

// Shopify webhook verification
// function verifyShopifyWebhook(data: string, signature: string, secret: string): boolean {
//   const hmac = crypto.createHmac('sha256', secret);
//   hmac.update(data, 'utf8');
//   const hash = hmac.digest('base64');
//   return hash === signature;
// }

// Handle Shopify webhook POST requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const data = JSON.parse(body);

    // Extract shop domain from headers (Shopify sends this in X-Shopify-Shop-Domain header)
    const shopDomain = request.headers.get('x-shopify-shop-domain') || process.env.SHOPIFY_SHOP_DOMAIN;

    // Parse API key from URL parameters
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key parameter' }, { status: 400 });
    }
    
    // Find merchant by API key
    const merchant = await prisma.merchant.findUnique({
      where: { apiKey }
    });
    
    if (!merchant) {
      console.error('Merchant not found for API key:', apiKey);
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Extract vendor from first line item (they should all be the same vendor)
    const vendor = data.line_items?.[0]?.vendor || merchant.name || 'Unknown Vendor';
    
    // Extract all product names from line items
    const productNames = data.line_items?.map((item: any) => item.title).filter(Boolean) || [];
    const productName = productNames.length > 1 
      ? productNames.join(', ') 
      : productNames[0] || 'Unknown Product';
    
    // Extract required fields
    const extractedData = {
      id: data.id,
      admin_graphql_api_id: data.admin_graphql_api_id,
      confirmation_number: data.confirmation_number,
      contact_email: data.contact_email || data.email,
      total_price: data.current_total_price,
      currency_code: data.currency,
      order_status_url: data.order_status_url,
      financial_status: data.financial_status,
      fulfillment_status: data.fulfillment_status,
      vendor: vendor,
      product_name: productName,
      product_count: data.line_items?.length || 0,
      shop_domain: shopDomain,
      merchant_wallet: merchant.walletAddress
    };

    console.log('Shopify webhook - extracted data:', extractedData);

    // Check if order already exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: String(data.id) }
    });

    if (existingOrder) {
      console.log('Order already exists:', existingOrder.id);
      return NextResponse.json({ 
        message: 'Order already exists',
        orderId: existingOrder.id,
        orderConfirmation: existingOrder.orderConfirmation
      }, { status: 200 });
    }

    // Insert into database
    const order = await prisma.order.create({
      data: {
        id: String(data.id), // Convert to string without prefix
        type: 'SHOPIFY',
        status: data.financial_status === 'paid' ? 'PAID' : 'PENDING',
        totalAmount: parseFloat(extractedData.total_price),
        currency: extractedData.currency_code,
        merchantName: extractedData.vendor,
        merchantWallet: merchant.walletAddress, // Add merchant wallet
        productName: extractedData.product_name,
        orderConfirmation: `${extractedData.confirmation_number}`,
        customerEmail: extractedData.contact_email,
        customerWallet: null,
        paymentMethod: 'shopify',
        adminGraphqlApiId: extractedData.admin_graphql_api_id,
        shopDomain: extractedData.shop_domain
      }
    })
    

    console.log('Order created in database:', order.id);

    // Send payment link via Shopify Order Note (appears in confirmation email)
    const paymentUrl = `https://cartee-dashboard.vercel.app/pay?orderId=${order.id}`;
    try {
      // Add note to order with payment instructions
      await fetch(`https://${shopDomain}/admin/api/2024-01/orders/${data.id}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': merchant.shopifyAccessToken || ''
        },
        body: JSON.stringify({
          order: {
            id: data.id,
            note: `MNEE Payment Link: ${paymentUrl}\n\nPlease complete payment using MNEE tokens.`,
            note_attributes: [
              { name: 'Payment Method', value: 'MNEE Token' },
              { name: 'Payment URL', value: paymentUrl }
            ]
          }
        })
      });

      console.log('Payment instructions added to Shopify order');
    } catch (error) {
      console.error('Failed to update Shopify order with payment link:', error);
    }

    return NextResponse.json({ 
      message: 'Webhook received and order created',
      extracted: extractedData,
      orderId: order.id,
      paymentUrl: paymentUrl
    }, { status: 200 });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Commented out complex webhook handlers - uncomment if needed:

// // Handle order creation from Shopify
// async function handleOrderCreate(orderData: any, shopDomain: string | null) {
//   try {
//     console.log('Processing order creation:', orderData.id);

//     // Find or create merchant based on shop domain
//     let merchant = await prisma.merchant.findFirst({
//       where: { 
//         OR: [
//           { name: shopDomain || 'Shopify Store' },
//           { email: { contains: shopDomain || '' } }
//         ]
//       }
//     });

//     if (!merchant) {
//       merchant = await prisma.merchant.create({
//         data: {
//           name: shopDomain || 'Shopify Store',
//           email: `admin@${shopDomain || 'shop'}.myshopify.com`,
//           walletAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0beb7'
//         }
//       });
//     }

//     // Create products for line items
//     const productPromises = orderData.line_items.map(async (item: any) => {
//       let product = await prisma.product.findFirst({
//         where: { 
//           name: item.title,
//           price: parseFloat(item.price)
//         }
//       });

//       if (!product) {
//         product = await prisma.product.create({
//           data: {
//             name: item.title,
//             description: item.title,
//             price: parseFloat(item.price),
//             currency: orderData.currency || 'USD',
//             imageUrl: item.image?.src
//           }
//         });
//       }

//       return { product, quantity: item.quantity, price: parseFloat(item.price) };
//     });

//     const productItems = await Promise.all(productPromises);

//     // Create order in our database
//     const order = await prisma.order.create({
//       data: {
//         id: `shopify_${orderData.id}`, // Prefix to avoid conflicts
//         merchantId: merchant.id,
//         totalAmount: parseFloat(orderData.total_price),
//         currency: orderData.currency || 'USD',
//         status: orderData.financial_status === 'paid' ? 'PAID' : 'PENDING',
//         customerEmail: orderData.customer?.email,
//         customerWallet: null,
//         orderItems: {
//           create: productItems.map(item => ({
//             productId: item.product.id,
//             quantity: item.quantity,
//             price: item.price
//           }))
//         }
//       }
//     });

//     console.log('Order created successfully:', order.id);

//     return NextResponse.json({ 
//       message: 'Order created successfully',
//       orderId: order.id 
//     }, { status: 201 });

//   } catch (error) {
//     console.error('Error creating order:', error);
//     return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
//   }
// }