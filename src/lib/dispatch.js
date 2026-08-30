/**
 * The dispatcher. Everything that reaches a customer passes through here.
 * Backed by Cloudflare D1 (via store.js). Order of checks, none skippable:
 *   1. Kill switch  2. Channel toggles  3. Dry run  4. Send window
 * Every outcome is written to message_log with a masked recipient.
 */

import { readSettings, getTemplate, logMessage } from './store.js';
import { getSecretRow } from './store.js';
import { decrypt } from './crypto.js';

function maskEmail(v) {
  const [u, d] = String(v || '').split('@');
  return d ? `${u.slice(0, 2)}***@${d}` : '***';
}
function maskPhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length < 4 ? '***' : `***${digits.slice(-4)}`;
}

function insideSendWindow(settings) {
  const w = settings.send_window || { start: '09:00', end: '21:00', tz: 'Asia/Dubai' };
  const now = new Date().toLocaleTimeString('en-GB', {
    timeZone: w.tz, hour12: false, hour: '2-digit', minute: '2-digit',
  });
  return now >= w.start && now <= w.end;
}

export function mapOrder(payload) {
  const money = (v) => `${Number(v || 0).toFixed(2)} AED`;
  const line = (payload.line_items || [])[0] || {};
  const ship = payload.shipping_address || {};
  return {
    name: (payload.customer && payload.customer.first_name) || 'there',
    email: (payload.customer && payload.customer.email) || payload.email,
    phone: (payload.customer && payload.customer.phone) || ship.phone,
    order: payload.name || `#${payload.order_number || ''}`,
    item: line.title || 'your piece',
    total: money(payload.total_price),
    statusUrl: payload.order_status_url || 'https://homekode.com/account',
  };
}

/** Reads a stored, encrypted vendor credential. Worker-side only. */
async function secret(env, key) {
  const row = await getSecretRow(env.DB, key);
  if (!row || !row.ciphertext) throw new Error(`${key} is not configured yet.`);
  return decrypt(env, row.ciphertext, row.iv);
}

export async function dispatch({ env, templateId, payload, webhookEventId }) {
  const DB = env.DB;
  const settings = await readSettings(DB);
  const merged = mapOrder(payload);
  const template = await getTemplate(DB, templateId);

  if (!template || !template.enabled) return { sent: 0, reason: 'template_disabled' };

  const channels = settings.channels || { email: true, whatsapp: true };
  const wanted = [];
  if (channels.email && merged.email) wanted.push('email');
  if (channels.whatsapp && merged.phone) wanted.push('whatsapp');

  const killed = settings.sending_enabled === false;
  const dryRun = settings.dry_run === true;
  const outsideWindow = !insideSendWindow(settings);
  const results = [];

  for (const channel of wanted) {
    const recipient = channel === 'email' ? maskEmail(merged.email) : maskPhone(merged.phone);
    const metaBlocked = channel === 'whatsapp' && template.meta_template_status !== 'approved';
    let status = 'sent', error = null, providerId = null;

    if (killed) { status = 'suppressed'; error = 'Global kill switch is on.'; }
    else if (outsideWindow) { status = 'queued'; error = 'Held until the next send window (9am-9pm Asia/Dubai).'; }
    else if (metaBlocked) { status = 'suppressed'; error = `WhatsApp template is ${template.meta_template_status}, not approved by Meta.`; }
    else if (dryRun) { status = 'suppressed'; error = 'Dry run: rendered and logged, not dispatched.'; }
    else {
      try {
        providerId = channel === 'email'
          ? await sendEmail(env, template, merged)
          : await sendWhatsApp(env, template, merged);
      } catch (err) { status = 'failed'; error = String(err && err.message ? err.message : err); }
    }

    await logMessage(DB, {
      template_id: template.id, channel, recipient, order_number: merged.order,
      webhook_event: webhookEventId, dry_run: dryRun, status,
      provider_id: providerId, error, rendered_subject: template.pill,
    });
    results.push({ channel, status });
  }
  return { sent: results.filter((r) => r.status === 'sent').length, results };
}

async function sendEmail(env, template, merged) {
  const apiKey = await secret(env, 'RESEND_API_KEY');
  const from = await secret(env, 'EMAIL_FROM').catch(() => 'HomeKode <orders@homekode.com>');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [merged.email],
      subject: template.headline.replace('{name}', merged.name),
      html: renderEmailHtml(template, merged),
    }),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
  return (await res.json()).id || null;
}

async function sendWhatsApp(env, template, merged) {
  const token = await secret(env, 'WHATSAPP_TOKEN');
  const phoneId = await secret(env, 'WHATSAPP_PHONE_ID');
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: String(merged.phone).replace(/\D/g, ''),
      type: 'template',
      template: {
        name: template.meta_template_name, language: { code: 'en' },
        components: [{ type: 'body', parameters: [
          { type: 'text', text: merged.name },
          { type: 'text', text: merged.order },
          { type: 'text', text: merged.item },
        ] }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp provider returned ${res.status}`);
  const j = await res.json();
  return (j.messages && j.messages[0] && j.messages[0].id) || null;
}

function renderEmailHtml(template, merged) {
  const body = template.body
    .replace(/\{name\}/g, merged.name).replace(/\{order\}/g, merged.order)
    .replace(/\{item\}/g, merged.item).replace(/\{total\}/g, merged.total);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#22201C">
    <p>${body}</p><p><a href="${merged.statusUrl}">View your order</a></p></body></html>`;
}
