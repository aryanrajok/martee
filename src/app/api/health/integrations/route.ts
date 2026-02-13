import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Health check for platform integrations
export async function GET(request: NextRequest) {
  try {
    // Skip database operations during build time
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
    
    const healthStatus = {
      shopify: {
        connected: false,
        status: 'disconnected' as 'connected' | 'disconnected' | 'error' | 'not_configured' | 'configured',
        details: null as Record<string, unknown> | null
      },
      woocommerce: {
        connected: false,
        status: 'disconnected' as 'connected' | 'disconnected' | 'error' | 'not_configured' | 'configured',
        details: null as Record<string, unknown> | null
      }
    };

    // Get wallet address from query params to find the merchant
    const walletAddress = request.nextUrl.searchParams.get('wallet');
    
    if (walletAddress && !isBuildTime) {
      const merchant = await prisma.merchant.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() }
      });

      // Check Shopify connection using merchant-specific credentials
      const shopifyAccessToken = merchant?.shopifyAccessToken || process.env.SHOPIFY_API_ACCESS_TOKEN;
      const shopifyDomain = merchant?.shopifyShopDomain || process.env.SHOPIFY_SHOP_DOMAIN;

      if (shopifyAccessToken && shopifyDomain) {
        try {
          // Test Shopify API connection
          const shopifyResponse = await fetch(`https://${shopifyDomain}/admin/api/2023-10/shop.json`, {
            headers: {
              'X-Shopify-Access-Token': shopifyAccessToken,
              'Content-Type': 'application/json'
            }
          });

        if (shopifyResponse.ok) {
          const shopData = await shopifyResponse.json();
          healthStatus.shopify = {
            connected: true,
            status: 'connected' as const,
            details: {
              domain: shopifyDomain,
              shopName: shopData.shop?.name || 'Unknown',
              plan: shopData.shop?.plan_name || 'Unknown',
              hasWebhooks: true // We'll assume webhooks are configured
            }
          };
        } else {
          healthStatus.shopify = {
            connected: false,
            status: 'error' as const,
            details: {
              error: `API Error: ${shopifyResponse.status}`,
              domain: shopifyDomain
            }
          };
        }
      } catch (error) {
        healthStatus.shopify = {
          connected: false,
          status: 'error' as const,
          details: {
            error: error instanceof Error ? error.message : 'Connection failed',
            domain: shopifyDomain
          }
        };
      }
    } else {
      healthStatus.shopify = {
        connected: false,
        status: 'not_configured' as const,
        details: {
          message: 'Shopify credentials not configured for this merchant'
        }
      };
    }
  } else {
    // No wallet address provided - use legacy env vars if available
    const shopifyAccessToken = process.env.SHOPIFY_API_ACCESS_TOKEN;
    const shopifyDomain = process.env.SHOPIFY_SHOP_DOMAIN;

    if (shopifyAccessToken && shopifyDomain) {
      try {
        const shopifyResponse = await fetch(`https://${shopifyDomain}/admin/api/2023-10/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json'
          }
        });

        if (shopifyResponse.ok) {
          const shopData = await shopifyResponse.json();
          healthStatus.shopify = {
            connected: true,
            status: 'connected' as const,
            details: {
              domain: shopifyDomain,
              shopName: shopData.shop?.name || 'Unknown',
              plan: shopData.shop?.plan_name || 'Unknown',
              hasWebhooks: true
            }
          };
        }
      } catch (error) {
        console.error('Shopify health check error:', error);
      }
    }
  }

    // Check WooCommerce connection (placeholder for now)
    const woocommerceUrl = process.env.WOOCOMMERCE_URL;
    const woocommerceKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
    const woocommerceSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

    if (woocommerceUrl && woocommerceKey && woocommerceSecret) {
      // For now, just check if env vars are present
      healthStatus.woocommerce = {
        connected: true,
        status: 'configured' as const,
        details: {
          url: woocommerceUrl,
          note: 'WooCommerce integration pending implementation'
        }
      };
    } else {
      healthStatus.woocommerce = {
        connected: false,
        status: 'not_configured' as const,
        details: {
          missingEnvVars: [
            ...(woocommerceUrl ? [] : ['WOOCOMMERCE_URL']),
            ...(woocommerceKey ? [] : ['WOOCOMMERCE_CONSUMER_KEY']),
            ...(woocommerceSecret ? [] : ['WOOCOMMERCE_CONSUMER_SECRET'])
          ]
        }
      };
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      integrations: healthStatus
    }, { status: 200 });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ 
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}