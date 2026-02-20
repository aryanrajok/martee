import { NextRequest, NextResponse } from 'next/server';

// ── CORS Middleware ─────────────────────────────────────────────────────────
// Allows the Cartee Chrome extension (content scripts) to call our API
// from any origin (checkout pages on WooCommerce, Shopify, etc.)

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only apply CORS headers to API routes
    if (!pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Handle preflight (OPTIONS) requests
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: corsHeaders(request),
        });
    }

    // For regular requests, add CORS headers to the response
    const response = NextResponse.next();
    const headers = corsHeaders(request);
    for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
    }
    return response;
}

function corsHeaders(request: NextRequest): Record<string, string> {
    const origin = request.headers.get('origin') || '*';

    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400', // Cache preflight for 24h
    };
}

export const config = {
    matcher: '/api/:path*',
};
