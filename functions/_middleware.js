/**
 * Edge middleware — security headers on every response.
 *
 * Auth note: this app is protected by Cloudflare Access (Zero Trust), which
 * sits IN FRONT of Pages. Nobody reaches the site without signing in at the
 * Access screen first, so there is no session gate to run here — Access has
 * already done it, and the per-API role check lives in each function via
 * src/lib/auth.js. The one carve-out is the Shopify webhook, which you add
 * as an Access "bypass" policy (it authenticates with an HMAC signature).
 */

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://cdn.shopify.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export async function onRequest(context) {
  const response = await context.next();
  const h = new Headers(response.headers);
  h.set('Content-Security-Policy', CSP);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return new Response(response.body, { status: response.status, headers: h });
}
