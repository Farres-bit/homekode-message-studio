/**
 * AES-256-GCM for the API-connections vault. The master key lives only in
 * the Cloudflare environment (INTEGRATIONS_MASTER_KEY, 32 bytes base64).
 * Nothing decrypted is ever returned to a browser.
 */

async function masterKey(env) {
  if (!env.INTEGRATIONS_MASTER_KEY) {
    throw new Error('INTEGRATIONS_MASTER_KEY is not set on this environment.');
  }
  const raw = Uint8Array.from(atob(env.INTEGRATIONS_MASTER_KEY), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('INTEGRATIONS_MASTER_KEY must be 32 bytes, base64-encoded.');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encrypt(env, plaintext) {
  const key = await masterKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: b64(ct), iv: b64(iv) };
}

export async function decrypt(env, ciphertext, iv) {
  const key = await masterKey(env);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ciphertext));
  return new TextDecoder().decode(pt);
}

/** 'shpat_xxxx4f2a' → 'shpat_••••4f2a'. Safe to show and to log. */
export function mask(value) {
  const v = String(value).trim();
  if (v.length <= 8) return '••••';
  const prefix = v.includes('_') ? v.slice(0, v.indexOf('_') + 1) : '';
  return `${prefix}••••${v.slice(-4)}`;
}
