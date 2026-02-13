import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Update merchant's Shopify configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shopifyAccessToken, shopifyShopDomain } = body;
    
    // Get API key from header for authentication
    const apiKey = request.headers.get('X-API-Key');
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required in X-API-Key header' }, { status: 401 });
    }

    if (!shopifyAccessToken || !shopifyShopDomain) {
      return NextResponse.json({ error: 'Shopify access token and domain required' }, { status: 400 });
    }

    // Find merchant by API key
    const merchant = await prisma.merchant.findUnique({
      where: { apiKey }
    });

    if (!merchant) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Update merchant with Shopify credentials
    const updatedMerchant = await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        shopifyAccessToken,
        shopifyShopDomain
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Shopify configuration saved successfully',
      merchant: {
        id: updatedMerchant.id,
        name: updatedMerchant.name,
        shopifyConfigured: true
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating Shopify configuration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get merchant's Shopify configuration status
export async function GET(request: NextRequest) {
  try {
    // Get API key from header for authentication
    const apiKey = request.headers.get('X-API-Key');
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required in X-API-Key header' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { apiKey },
      select: {
        id: true,
        name: true,
        shopifyAccessToken: true,
        shopifyShopDomain: true
      }
    });

    if (!merchant) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    return NextResponse.json({
      configured: !!merchant.shopifyAccessToken && !!merchant.shopifyShopDomain,
      hasToken: !!merchant.shopifyAccessToken,
      hasDomain: !!merchant.shopifyShopDomain,
      domain: merchant.shopifyShopDomain || null
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching Shopify configuration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}