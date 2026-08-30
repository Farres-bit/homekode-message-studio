-- =====================================================================
-- HomeKode · Message Studio — Cloudflare D1 schema (SQLite dialect)
-- Supabase-free. Run with:  wrangler d1 execute homekode_studio --file db/schema.d1.sql
--
-- What changed vs the Postgres version, and why it's still just as safe:
--   • No Postgres RLS. Access control is enforced in the Worker, which is
--     the only thing that can reach D1 — the browser never gets a DB handle.
--   • No enums / plpgsql. SQLite uses CHECK constraints and app-side guards.
--   • Auth is Cloudflare Access (Zero Trust), not Supabase Auth. Access puts
--     a verified email in a signed JWT header on every request; the Worker
--     maps that email to a role in the users table below.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- 1. Users & roles  (email comes from the Cloudflare Access JWT)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  email       TEXT PRIMARY KEY,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('owner','editor','viewer')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- 2. Templates (the 30 authored in Module 1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id             TEXT PRIMARY KEY,
  family         TEXT NOT NULL CHECK (family IN ('order','returns')),
  emoji          TEXT,
  pill           TEXT NOT NULL,
  headline       TEXT NOT NULL,
  body           TEXT NOT NULL,
  whatsapp_body  TEXT NOT NULL,
  reason_set     TEXT,
  fields         TEXT NOT NULL DEFAULT '[]',   -- JSON as text
  full_order     INTEGER NOT NULL DEFAULT 0,   -- 0/1
  meta_template_name    TEXT,
  meta_template_status  TEXT NOT NULL DEFAULT 'not_submitted'
                 CHECK (meta_template_status IN ('not_submitted','pending','approved','rejected')),
  enabled        INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT
);

CREATE TABLE IF NOT EXISTS reasons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reason_set  TEXT NOT NULL,
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  line        TEXT NOT NULL,
  UNIQUE (reason_set, code)
);

-- ---------------------------------------------------------------------
-- 3. Settings — kill switch, dry-run, channels, send window
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,                    -- JSON as text
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('sending_enabled', 'true'),
  ('dry_run',         'true'),
  ('channels',        '{"email":true,"whatsapp":true}'),
  ('send_window',     '{"start":"09:00","end":"21:00","tz":"Asia/Dubai"}');

-- ---------------------------------------------------------------------
-- 4. Webhook ledger — idempotency. One Shopify action, one message.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id            TEXT PRIMARY KEY,               -- uuid, generated in Worker
  shopify_id    TEXT NOT NULL UNIQUE,           -- X-Shopify-Webhook-Id
  topic         TEXT NOT NULL,
  shop_domain   TEXT,
  payload       TEXT NOT NULL,                  -- JSON as text
  received_at   TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at  TEXT,
  status        TEXT NOT NULL DEFAULT 'received'
                CHECK (status IN ('received','processed','skipped','failed')),
  error         TEXT
);
CREATE INDEX IF NOT EXISTS webhook_events_received_idx ON webhook_events (received_at DESC);

-- ---------------------------------------------------------------------
-- 5. Audit log — who, what, when, to whom, which channel, result
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_log (
  id               TEXT PRIMARY KEY,            -- uuid, generated in Worker
  template_id      TEXT,
  reason_code      TEXT,
  channel          TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
  recipient        TEXT NOT NULL,               -- masked at write time
  order_number     TEXT,
  ticket_id        TEXT,
  triggered_by     TEXT NOT NULL DEFAULT 'shopify_webhook',
  webhook_event    TEXT,
  dry_run          INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL CHECK (status IN ('queued','sent','failed','suppressed')),
  provider_id      TEXT,
  error            TEXT,
  rendered_subject TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS message_log_created_idx ON message_log (created_at DESC);
CREATE INDEX IF NOT EXISTS message_log_order_idx   ON message_log (order_number);

-- ---------------------------------------------------------------------
-- 6. Live Website Updates — snapshot + diff
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_snapshots (
  handle        TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  product_type  TEXT,
  price         REAL,
  compare_at    REAL,
  available     INTEGER,
  image_url     TEXT,
  updated_at    TEXT,
  seen_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS store_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL CHECK (kind IN
                ('new_arrival','price_drop','price_increase','back_in_stock','sold_out','collection_updated')),
  handle      TEXT,
  title       TEXT NOT NULL,
  detail      TEXT,
  old_value   REAL,
  new_value   REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS store_events_created_idx ON store_events (created_at DESC);

-- ---------------------------------------------------------------------
-- 7. API connections vault — AES-256-GCM ciphertext only, never plaintext
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_secrets (
  key             TEXT PRIMARY KEY,
  system          TEXT NOT NULL CHECK (system IN
                    ('shopify','dobesell','freshdesk','email','whatsapp','platform')),
  label           TEXT NOT NULL,
  ciphertext      TEXT,
  iv              TEXT,
  masked_preview  TEXT,
  required        INTEGER NOT NULL DEFAULT 1,
  module          INTEGER NOT NULL,
  help            TEXT,
  status          TEXT NOT NULL DEFAULT 'missing'
                    CHECK (status IN ('missing','saved','verified','failed')),
  last_tested_at  TEXT,
  last_test_note  TEXT,
  updated_at      TEXT,
  updated_by      TEXT
);

INSERT OR IGNORE INTO integration_secrets (key, system, label, required, module, help) VALUES
  ('SHOPIFY_SHOP_DOMAIN','shopify','Shop domain',1,3,'Looks like homekode.myshopify.com'),
  ('SHOPIFY_ADMIN_TOKEN','shopify','Admin API access token',1,3,'Your custom app → API credentials'),
  ('SHOPIFY_WEBHOOK_SECRET','shopify','Webhook signing secret',1,3,'Your custom app → Webhooks signing secret'),
  ('SHOPIFY_API_VERSION','shopify','Admin API version',0,3,'e.g. 2026-07. Blank uses current stable.'),
  ('DOBESELL_BASE_URL','dobesell','API base URL',1,3,'Root URL from IT, e.g. https://api.dobesell.com/v1'),
  ('DOBESELL_API_KEY','dobesell','API key',1,3,'Read-only key scoped to orders, AWB and fulfilment'),
  ('DOBESELL_AUTH_SCHEME','dobesell','Auth scheme',0,3,'Bearer, ApiKey or Basic'),
  ('FRESHDESK_DOMAIN','freshdesk','Freshdesk domain',1,3,'Looks like homekode.freshdesk.com'),
  ('FRESHDESK_API_KEY','freshdesk','API key',1,3,'Profile settings → Your API key'),
  ('FRESHDESK_REASON_FIELD','freshdesk','Reason-code ticket field',0,3,'Custom field ID holding the return reason'),
  ('RESEND_API_KEY','email','Email provider API key',1,4,'Provider dashboard'),
  ('EMAIL_FROM','email','From address',1,4,'HomeKode <orders@homekode.com>'),
  ('EMAIL_REPLY_TO','email','Reply-to address',0,4,'Usually the Freshdesk inbox'),
  ('WHATSAPP_TOKEN','whatsapp','Permanent access token',1,6,'Meta Business → WhatsApp → API setup'),
  ('WHATSAPP_PHONE_ID','whatsapp','Phone number ID',1,6,'Meta Business → WhatsApp → API setup'),
  ('WHATSAPP_WABA_ID','whatsapp','WhatsApp Business Account ID',1,6,'Needed to submit templates for approval'),
  ('POLL_TRIGGER_KEY','platform','Store-poller trigger key',0,5,'Any long random string');

-- =====================================================================
-- After running this, set yourself as owner (only done once, by hand):
--   wrangler d1 execute homekode_studio --command \
--     "INSERT INTO users(email,role) VALUES('ahmefare@outlook.com','owner')
--      ON CONFLICT(email) DO UPDATE SET role='owner';"
-- From then on the app grants new Access users 'viewer', and only the
-- owner can promote — enforced in the Worker, same rule as before.
-- =====================================================================
