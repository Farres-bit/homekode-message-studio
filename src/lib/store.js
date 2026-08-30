/**
 * Data-access layer over Cloudflare D1 (SQLite).
 *
 * This replaces the Supabase client entirely. D1 is bound to the Worker as
 * env.DB and is unreachable from the browser — so access control lives here
 * and in auth.js, not in database policies.
 *
 * Every function takes the D1 binding (env.DB) as its first argument.
 */

export const uuid = () => crypto.randomUUID();

/* ---- settings ---- */
export async function readSettings(DB) {
  const { results } = await DB.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const row of results) {
    try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
  }
  return out;
}

export async function writeSetting(DB, key, value, byEmail) {
  await DB.prepare(
    `UPDATE settings SET value = ?, updated_at = datetime('now'), updated_by = ? WHERE key = ?`
  ).bind(JSON.stringify(value), byEmail || null, key).run();
}

/* ---- users / roles ---- */
export async function getUser(DB, email) {
  return DB.prepare('SELECT email, full_name, role FROM users WHERE email = ?')
    .bind(email).first();
}

/** First time we see an Access-authenticated email, record it as viewer. */
export async function ensureUser(DB, email, fullName) {
  await DB.prepare(
    `INSERT INTO users (email, full_name, role) VALUES (?, ?, 'viewer')
     ON CONFLICT(email) DO NOTHING`
  ).bind(email, fullName || null).run();
  return getUser(DB, email);
}

export async function setRole(DB, targetEmail, role) {
  await DB.prepare('UPDATE users SET role = ? WHERE email = ?').bind(role, targetEmail).run();
}

/* ---- templates ---- */
export async function getTemplate(DB, id) {
  return DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
}

/* ---- integration secrets ---- */
export async function listIntegrationStatus(DB) {
  const { results } = await DB.prepare(
    `SELECT key, system, label, masked_preview, required, module, help,
            status, last_tested_at, last_test_note, updated_at
       FROM integration_secrets ORDER BY module, key`
  ).all();
  return results; // note: ciphertext/iv are deliberately NOT selected
}

export async function getSecretRow(DB, key) {
  return DB.prepare('SELECT ciphertext, iv FROM integration_secrets WHERE key = ?')
    .bind(key).first();
}

export async function saveSecret(DB, key, ciphertext, iv, masked, byEmail) {
  await DB.prepare(
    `UPDATE integration_secrets
       SET ciphertext = ?, iv = ?, masked_preview = ?, status = 'saved',
           updated_at = datetime('now'), updated_by = ?, last_test_note = NULL
     WHERE key = ?`
  ).bind(ciphertext, iv, masked, byEmail || null, key).run();
}

export async function markSystemTested(DB, system, status, note) {
  await DB.prepare(
    `UPDATE integration_secrets
       SET status = ?, last_tested_at = datetime('now'), last_test_note = ?
     WHERE system = ? AND ciphertext IS NOT NULL`
  ).bind(status, note, system).run();
}

/* ---- webhook ledger (idempotency) ---- */
export async function recordWebhook(DB, { shopifyId, topic, shopDomain, payload }) {
  const id = uuid();
  try {
    await DB.prepare(
      `INSERT INTO webhook_events (id, shopify_id, topic, shop_domain, payload)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, shopifyId, topic, shopDomain || null, JSON.stringify(payload)).run();
    return { id, duplicate: false };
  } catch (e) {
    if (String(e.message || e).includes('UNIQUE')) return { id: null, duplicate: true };
    throw e;
  }
}

export async function markWebhook(DB, id, status, error) {
  await DB.prepare(
    `UPDATE webhook_events SET status = ?, processed_at = datetime('now'), error = ? WHERE id = ?`
  ).bind(status, error || null, id).run();
}

/* ---- audit log ---- */
export async function logMessage(DB, row) {
  await DB.prepare(
    `INSERT INTO message_log
      (id, template_id, reason_code, channel, recipient, order_number, ticket_id,
       triggered_by, webhook_event, dry_run, status, provider_id, error, rendered_subject)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    uuid(), row.template_id || null, row.reason_code || null, row.channel,
    row.recipient, row.order_number || null, row.ticket_id || null,
    row.triggered_by || 'shopify_webhook', row.webhook_event || null,
    row.dry_run ? 1 : 0, row.status, row.provider_id || null,
    row.error || null, row.rendered_subject || null
  ).run();
}

/* ---- store feed ---- */
export async function getSnapshots(DB) {
  const { results } = await DB.prepare(
    'SELECT handle, title, price, compare_at, available FROM product_snapshots'
  ).all();
  return results;
}

export async function upsertSnapshot(DB, p) {
  await DB.prepare(
    `INSERT INTO product_snapshots (handle,title,product_type,price,compare_at,available,image_url,updated_at,seen_at)
     VALUES (?,?,?,?,?,?,?,?,datetime('now'))
     ON CONFLICT(handle) DO UPDATE SET
       title=excluded.title, product_type=excluded.product_type, price=excluded.price,
       compare_at=excluded.compare_at, available=excluded.available,
       image_url=excluded.image_url, updated_at=excluded.updated_at, seen_at=datetime('now')`
  ).bind(p.handle, p.title, p.product_type, p.price, p.compare_at,
         p.available ? 1 : 0, p.image_url, p.updated_at).run();
}

export async function insertStoreEvents(DB, events) {
  for (const e of events) {
    await DB.prepare(
      `INSERT INTO store_events (kind, handle, title, detail, old_value, new_value)
       VALUES (?,?,?,?,?,?)`
    ).bind(e.kind, e.handle || null, e.title, e.detail || null,
           e.old_value ?? null, e.new_value ?? null).run();
  }
}
