/**
 * Authentication via Cloudflare Access (Zero Trust). No Supabase Auth.
 *
 * Cloudflare Access sits in front of the whole site. A visitor signs in
 * with the identity provider you configure (Google, one-time email PIN,
 * etc.), and Access then forwards every request with a signed JWT in the
 * `Cf-Access-Jwt-Assertion` header. We verify that JWT against your team's
 * public keys, so the email cannot be forged.
 *
 * The Worker maps the verified email to a role in the D1 users table.
 */

import { ensureUser } from './store.js';

let JWKS_CACHE = { keys: null, at: 0 };

async function teamKeys(env) {
  const now = Date.now();
  if (JWKS_CACHE.keys && now - JWKS_CACHE.at < 3600_000) return JWKS_CACHE.keys;
  const res = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Could not fetch Cloudflare Access keys.');
  const jwks = await res.json();
  JWKS_CACHE = { keys: jwks.keys, at: now };
  return jwks.keys;
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function verifyAccessJwt(env, token) {
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) throw new Error('Malformed token.');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));

  const jwk = (await teamKeys(env)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key.');

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key,
    b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`)
  );
  if (!ok) throw new Error('Bad signature.');

  const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  if (claims.exp && Date.now() / 1000 > claims.exp) throw new Error('Token expired.');
  if (env.ACCESS_AUD && claims.aud && !(
    Array.isArray(claims.aud) ? claims.aud.includes(env.ACCESS_AUD) : claims.aud === env.ACCESS_AUD
  )) throw new Error('Wrong audience.');

  return claims; // { email, ... }
}

/**
 * Returns { email, role } for the current request, or null if not signed in.
 * Records first-seen users as 'viewer'.
 */
export async function currentUser(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  let claims;
  try {
    claims = await verifyAccessJwt(env, token);
  } catch {
    return null;
  }
  if (!claims.email) return null;
  const user = await ensureUser(env.DB, claims.email, claims.name);
  return { email: user.email, role: user.role };
}

export async function requireRole(request, env, allowed) {
  const user = await currentUser(request, env);
  if (!user) return { error: 'Sign in to continue.', status: 401 };
  if (!allowed.includes(user.role)) return { error: 'You do not have permission for that.', status: 403 };
  return { user };
}
