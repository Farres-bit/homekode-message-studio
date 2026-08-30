/**
 * API Connections — paste, save, test. Backed by Cloudflare D1.
 *
 * GET   /api/integrations        → masked status of every slot (never the key)
 * PUT   /api/integrations        → save one credential (owner only)
 * POST  /api/integrations/test   → live connection test (owner or editor)
 */

import { requireRole } from '../../src/lib/auth.js';
import { encrypt, decrypt, mask } from '../../src/lib/crypto.js';
import { listIntegrationStatus, getSecretRow, saveSecret, markSystemTested } from '../../src/lib/store.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const gate = await requireRole(request, env, ['owner', 'editor', 'viewer']);
  if (gate.error) return Response.json({ error: gate.error }, { status: gate.status });
  const connections = await listIntegrationStatus(env.DB);
  return Response.json({ connections });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const gate = await requireRole(request, env, ['owner']);
  if (gate.error) return Response.json({ error: gate.error }, { status: gate.status });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Send a JSON body with key and value.' }, { status: 400 });
  }
  const { key, value } = body;
  if (!key || typeof value !== 'string' || !value.trim()) {
    return Response.json({ error: 'Paste a value before saving.' }, { status: 400 });
  }

  const slot = await getSecretRow(env.DB, key);
  if (slot === null) {
    return Response.json({ error: `${key} is not a connection this app uses.` }, { status: 400 });
  }

  const { ciphertext, iv } = await encrypt(env, value.trim());
  await saveSecret(env.DB, key, ciphertext, iv, mask(value), gate.user.email);
  return Response.json({ ok: true, key, masked_preview: mask(value), status: 'saved' });
}

const TESTS = {
  shopify: async (get) => {
    const domain = await get('SHOPIFY_SHOP_DOMAIN');
    const token = await get('SHOPIFY_ADMIN_TOKEN');
    const version = (await get('SHOPIFY_API_VERSION').catch(() => '')) || '2026-07';
    const res = await fetch(`https://${domain}/admin/api/${version}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    });
    if (!res.ok) throw new Error(`Shopify replied ${res.status}. Check the domain and token.`);
    const j = await res.json();
    return `Connected to ${j.shop?.name || domain}.`;
  },
  dobesell: async (get) => {
    const base = (await get('DOBESELL_BASE_URL')).replace(/\/+$/, '');
    const key = await get('DOBESELL_API_KEY');
    const scheme = (await get('DOBESELL_AUTH_SCHEME').catch(() => '')) || 'Bearer';
    const res = await fetch(`${base}/health`, { headers: { Authorization: `${scheme} ${key}` } });
    if (!res.ok) throw new Error(`Dobesell replied ${res.status}. Confirm the base URL and auth scheme with IT.`);
    return 'Dobesell responded successfully.';
  },
  freshdesk: async (get) => {
    const domain = await get('FRESHDESK_DOMAIN');
    const key = await get('FRESHDESK_API_KEY');
    const res = await fetch(`https://${domain}/api/v2/agents/me`, {
      headers: { Authorization: `Basic ${btoa(`${key}:X`)}` },
    });
    if (!res.ok) throw new Error(`Freshdesk replied ${res.status}. Check the domain and API key.`);
    const j = await res.json();
    return `Connected as ${j.contact?.name || 'agent'}.`;
  },
  email: async (get) => {
    const key = await get('RESEND_API_KEY');
    const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Email provider replied ${res.status}. Check the API key.`);
    return 'Email provider reachable. Verify SPF, DKIM and DMARC next.';
  },
  whatsapp: async (get) => {
    const token = await get('WHATSAPP_TOKEN');
    const phoneId = await get('WHATSAPP_PHONE_ID');
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Meta replied ${res.status}. Check the token and phone number ID.`);
    const j = await res.json();
    return `Connected to ${j.display_phone_number || 'the WhatsApp number'}.`;
  },
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const gate = await requireRole(request, env, ['owner', 'editor']);
  if (gate.error) return Response.json({ error: gate.error }, { status: gate.status });

  const { system } = await request.json().catch(() => ({}));
  if (!TESTS[system]) return Response.json({ error: 'Nothing to test for that system.' }, { status: 400 });

  const get = async (key) => {
    const row = await getSecretRow(env.DB, key);
    if (!row || !row.ciphertext) throw new Error(`${key} has not been saved yet.`);
    return decrypt(env, row.ciphertext, row.iv);
  };

  let status = 'verified', note;
  try { note = await TESTS[system](get); }
  catch (err) { status = 'failed'; note = String(err && err.message ? err.message : err); }

  await markSystemTested(env.DB, system, status, note);
  return Response.json({ ok: status === 'verified', status, note });
}
