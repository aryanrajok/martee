import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// import crypto from 'crypto';

// WooCommerce webhook verification (uncomment if needed)
// function verifyWooCommerceWebhook(data: string, signature: string, secret: string): boolean {
//   const hmac = crypto.createHmac('sha256', secret);
//   hmac.update(data, 'utf8');
//   const hash = hmac.digest('base64');
//   return hash === signature;
// }

// Handle WooCommerce webhook POST requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const data = JSON.parse(body);
    console.log(data)
    // Get the merchant by API key from the webhook data
    const apiKey = data.api_key;
    
    if (!apiKey) {
      console.error('No API key provided in webhook data');
      return NextResponse.json({ 
        error: 'API key required' 
      }, { status: 400 });
    }
    
    const merchant = await prisma.merchant.findUnique({
      where: { apiKey: apiKey }
    });
    
    if (!merchant) {
      console.error('No merchant found with API key:', apiKey);
      return NextResponse.json({ 
        error: 'Invalid API key' 
      }, { status: 401 });
    }
    // Extract required fields from WooCommerce webhook payload
    const extractedData = {
      basic_id: data.order_id,
      order_key_id: data.order_key,
      contact_email: data.email,
      store_name: data.store_name,
      total_price: data.total,
      currency_code: data.currency_code,
      product_name: data.product_name,
      merchant_wallet: merchant.walletAddress,
      api_key: data.api_key
    };

    console.log('WooCommerce webhook - extracted data:', extractedData);

    // Check if order already exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: String(extractedData.order_key_id) }
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
        id: String(extractedData.order_key_id),
        type: 'WOOCOMMERCE',
        status: 'PENDING',
        totalAmount: parseFloat(extractedData.total_price),
        currency: extractedData.currency_code,
        merchantName: extractedData.store_name || merchant.name,
        merchantWallet: merchant.walletAddress,
        productName: extractedData.product_name,
        orderConfirmation: String(extractedData.basic_id),
        customerEmail: extractedData.contact_email,
        customerWallet: null,
        paymentMethod: 'woocommerce',
        adminGraphqlApiId: null,
        shopDomain: null
      }
    });

    console.log('WooCommerce order created in database:', order.id);

    return NextResponse.json({ 
      message: 'Webhook received and order created',
      extracted: extractedData,
      orderId: order.id
    }, { status: 200 });

  } catch (error) {
    console.error('WooCommerce webhook processing error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}