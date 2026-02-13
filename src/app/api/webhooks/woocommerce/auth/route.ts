import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get the API key from headers
    const apiKey = request.headers.get('X-API-Key');
    const storeName = request.headers.get('X-Store-Name');
    const siteUrl = request.headers.get('X-Site-URL');
    
    console.log('WooCommerce auth request:', {
      apiKey: apiKey ? `${apiKey.slice(0, 4)}...` : null,
      storeName,
      siteUrl
    });
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'API key is required' 
        },
        { status: 400 }
      );
    }

    // Find merchant with this API key
    const merchant = await prisma.merchant.findUnique({
      where: {
        apiKey: apiKey
      }
    });

    if (!merchant) {
      return NextResponse.json(false, { status: 200 });
    }

    // Update merchant to enable WooCommerce and optionally update store details
    const updateData: any = {
      wooCommerceEnabled: true
    };
    
    // If store name is provided and different, update it
    if (storeName && merchant.name === 'Unnamed Merchant') {
      updateData.name = storeName;
    }
    
    // If site URL is provided, update it
    if (siteUrl) {
      updateData.wooCommerceSiteURL = siteUrl;
    }

    if (!merchant.wooCommerceEnabled || updateData.name || updateData.wooCommerceSiteURL) {
      await prisma.merchant.update({
        where: {
          apiKey: apiKey
        },
        data: updateData
      });
    }

    // Return success with merchant details
    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        name: updateData.name || merchant.name,
        walletAddress: merchant.walletAddress,
        wooCommerceEnabled: true
      },
      store: {
        name: storeName,
        url: siteUrl
      }
    });

  } catch (error) {
    console.error('WooCommerce auth error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// POST endpoint for authenticating via body
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'API key is required' 
        },
        { status: 400 }
      );
    }

    // Find merchant with this API key
    const merchant = await prisma.merchant.findUnique({
      where: {
        apiKey: apiKey
      }
    });

    if (!merchant) {
      return NextResponse.json(false, { status: 200 });
    }

    // Update merchant to enable WooCommerce if not already enabled
    if (!merchant.wooCommerceEnabled) {
      await prisma.merchant.update({
        where: {
          id: merchant.id
        },
        data: {
          wooCommerceEnabled: true
        }
      });
    }

    // Return success with merchant details
    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        walletAddress: merchant.walletAddress,
        wooCommerceEnabled: true
      }
    });

  } catch (error) {
    console.error('WooCommerce auth error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}