/**
 * Shopify webhook receiver — Cloudflare D1 backed.
 *
 * Only entry point that can cause a customer message, and the only route
 * that skips the Access gate (webhooks carry an HMAC, not a session).
 *   1. HMAC-SHA256 verified in constant time
 *   2. Shop-domain checked
 *   3. Idempotent on X-Shopify-Webhook-Id
 */

import { dispatch } from '../../../src/lib/dispatch.js';
import { recordWebhook, markWebhook } from '../../../src/lib/store.js';

const TOPIC_MAP = {
  'orders/create': 'order_confirmed',
  'orders/paid': 'payment_confirmed',
  'orders/updated': 'order_modified',
  'orders/cancelled': 'order_cancelled',
  'orders/fulfilled': 'fulfilled',
  'orders/partially_fulfilled': 'partially_fulfilled',
  'fulfillments/create': 'shipped',
  'fulfillments/update': 'out_for_delivery',
  'refunds/create': 'ret_refund_initiated',
};

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyHmac(rawBody, header, secret) {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(btoa(String.fromCharCode(...new Uint8Array(sig))), header);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const raw = await request.text();
  const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
  const topic = request.headers.get('X-Shopify-Topic') || '';
  const webhookId = request.headers.get('X-Shopify-Webhook-Id') || '';
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain') || '';

  if (!(await verifyHmac(raw, hmacHeader, env.SHOPIFY_WEBHOOK_SECRET))) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (env.SHOPIFY_SHOP_DOMAIN && shopDomain !== env.SHOPIFY_SHOP_DOMAIN) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!webhookId) return new Response('Missing webhook id', { status: 400 });

  let payload;
  try { payload = JSON.parse(raw); } catch { return new Response('Bad payload', { status: 400 }); }

  const { id, duplicate } = await recordWebhook(env.DB, { shopifyId: webhookId, topic, shopDomain, payload });
  if (duplicate) return Response.json({ ok: true, duplicate: true });

  const templateId = TOPIC_MAP[topic];
  if (!templateId) {
    await markWebhook(env.DB, id, 'skipped');
    return Response.json({ ok: true, skipped: topic });
  }

  try {
    const result = await dispatch({ env, templateId, payload, webhookEventId: id });
    await markWebhook(env.DB, id, 'processed');
    return Response.json({ ok: true, ...result });
  } catch (err) {
    await markWebhook(env.DB, id, 'failed', String(err && err.message ? err.message : err));
    return Response.json({ ok: false, logged: true }); // 200: ours to retry, not Shopify's
  }
}
