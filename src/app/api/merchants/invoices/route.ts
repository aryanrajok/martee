import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
console.log('Invoices route loaded - Prisma client created:', !!prisma, typeof prisma);

// Get merchant's invoices
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Fetch all orders for this merchant (all types)
    const invoices = await prisma.order.findMany({
      where: {
        merchantWallet: walletAddress.toLowerCase()
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(invoices, { status: 200 });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create new invoice
export async function POST(request: NextRequest) {
  try {
    // Check for API key authentication
    const apiKey = request.headers.get('x-api-key');
    
    const body = await request.json();
    const {
      productName,
      totalAmount,
      currency = 'MNEE',
      customerEmail,
      description,
      _merchantWallet,
      expiresInHours = 24  // Default to 24 hours if not specified
    } = body;

    if (!productName || !totalAmount) {
      return NextResponse.json({ 
        error: 'Product name and amount are required' 
      }, { status: 400 });
    }

    let merchant;
    let merchantWallet = _merchantWallet
    // If API key is provided, authenticate using API key
    if (apiKey) {
      merchant = await prisma.merchant.findUnique({
        where: { apiKey }
      });

      if (!merchant) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }

      // Use the merchant's wallet address from the API key lookup
      merchantWallet = merchant.walletAddress;
    } else if (merchantWallet) {
      // Fallback to wallet address lookup (for dashboard usage)
      merchant = await prisma.merchant.findUnique({
        where: { walletAddress: merchantWallet.toLowerCase() }
      });

      if (!merchant) {
        return NextResponse.json({ error: 'Merchant not found. Please refresh the dashboard.' }, { status: 404 });
      }
    } else {
      return NextResponse.json({ 
        error: 'Either API key (via X-API-Key header) or merchantWallet is required' 
      }, { status: 400 });
    }

    // Calculate expiration date for direct invoices
    let expiresAt = null;
    if (expiresInHours && expiresInHours > 0) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiresInHours.toString()));
    }
    
    // Create the invoice/order
    const invoice = await prisma.order.create({
      data: {
        type: 'DIRECT',
        status: 'PENDING',
        merchantName: merchant.name,
        merchantWallet: merchant.walletAddress.toLowerCase(),
        productName,
        totalAmount: parseFloat(totalAmount.toString()),
        currency,
        customerEmail: customerEmail || null,
        orderConfirmation: description || null,
        expiresAt: expiresAt  // Set expiration for direct invoices
      }
    });

    return NextResponse.json({
      ...invoice,
      paymentLink: `/pay?orderId=${invoice.id}`
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}