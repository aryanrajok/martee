import crypto from 'crypto';

/**
 * Verify Shopify webhook signature
 * @param rawBody - Raw request body as string
 * @param hmacHeader - X-Shopify-Hmac-SHA256 header value
 * @param secret - Shopify webhook secret
 * @returns boolean indicating if signature is valid
 */
export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string,
  secret: string
): boolean {
  if (!secret) {
    console.warn('Shopify webhook secret not configured');
    return true; // Allow in development
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(hmacHeader)
  );
}

/**
 * Verify WooCommerce webhook signature
 * @param rawBody - Raw request body as string
 * @param signatureHeader - X-WC-Webhook-Signature header value
 * @param secret - WooCommerce webhook secret
 * @returns boolean indicating if signature is valid
 */
export function verifyWooCommerceWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!secret) {
    console.warn('WooCommerce webhook secret not configured');
    return true; // Allow in development
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signatureHeader)
  );
}

/**
 * Hash API key for secure storage
 * @param apiKey - Plain text API key
 * @returns Promise<string> - Hashed API key
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(apiKey, 10);
}

/**
 * Verify API key against hash
 * @param apiKey - Plain text API key
 * @param hash - Hashed API key from database
 * @returns Promise<boolean> - True if API key matches
 */
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(apiKey, hash);
}

/**
 * Generate a secure random API key
 * @param length - Length of API key (default 32)
 * @returns string - Random API key
 */
export function generateApiKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Rate limit check (simple in-memory implementation)
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    // Create new window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs
    };
  }

  if (record.count >= maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(identifier, record);

  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime
  };
}

/**
 * Clean up expired rate limit records (call periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}
