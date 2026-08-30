# HomeKode · Message Studio

Post-action email and WhatsApp framework. Triggered by Shopify, enriched from
Dobesell and Freshdesk, delivered on both channels.

> **Stack: Cloudflare + GitHub only. No Supabase, no third-party database.**
> Everything in this repo is credential-free — no keys, no tokens, no customer data.

---

## Architecture (Supabase-free)

| Concern | Was going to be | Now is |
|---|---|---|
| Hosting + Functions | Cloudflare Pages | **Cloudflare Pages** (unchanged) |
| Database | Supabase Postgres | **Cloudflare D1** (SQLite at the edge) |
| Auth | Supabase Auth | **Cloudflare Access** (Zero Trust) |
| Secrets vault | Postgres + AES-GCM | **D1 + AES-GCM** (unchanged crypto) |
| Store poller | Cron Worker | **Cron Worker** (unchanged) |
| Source control | GitHub | **GitHub** (unchanged) |

Access control moved from Postgres RLS into the Worker (`src/lib/auth.js`),
which is the only thing that can reach D1 — the browser never gets a DB handle.
Same guarantee, different enforcement point.

```
functions/
  _middleware.js              Security headers (Access does the auth gate in front)
  api/integrations.js         Paste / save / test API keys — D1 backed
  api/webhooks/shopify.js     HMAC-verified webhook receiver — the only send trigger
src/lib/
  auth.js                     Cloudflare Access JWT verify → role from D1
  store.js                    All D1 queries (the data layer)
  crypto.js                   AES-256-GCM for the vault
  dispatch.js                 Kill switch, dry run, send window, audit log, providers
worker/poll-products.js       Live Website Updates poller (cron + diff)
db/schema.d1.sql              The whole database, SQLite dialect
public/                       The Message Studio front end (Module 1)
```

---

## Deploy runbook (all Cloudflare + GitHub)

### 1 · GitHub
Create a **private** repo `homekode-message-studio`, push this tree.

### 2 · Cloudflare D1 (the database)
```
npx wrangler d1 create homekode_studio
```
Copy the printed `database_id` into **both** `wrangler.toml` and
`wrangler.pages.toml`. Then load the schema:
```
npx wrangler d1 execute homekode_studio --file db/schema.d1.sql --remote
```
Make yourself owner (the one manual step, done once):
```
npx wrangler d1 execute homekode_studio --remote --command \
  "INSERT INTO users(email,role) VALUES('ahmefare@outlook.com','owner')
   ON CONFLICT(email) DO UPDATE SET role='owner';"
```

### 3 · Cloudflare Pages
1. Pages → Create → Connect to Git → this repo. Build output dir: `public`.
2. Settings → Functions → **D1 bindings** → add `DB` → `homekode_studio`.
3. Settings → Environment variables (encrypted):
   - `INTEGRATIONS_MASTER_KEY` — generate: `openssl rand -base64 32`
   - `ACCESS_TEAM_DOMAIN` — `your-team.cloudflareaccess.com`
   - `ACCESS_AUD` — the Access app Audience tag (from step 4)
   - `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_SHOP_DOMAIN` — Module 3

### 4 · Cloudflare Access (sign-in, replaces Supabase Auth)
1. Zero Trust → Access → Applications → **Add** → Self-hosted.
2. Domain = your Pages domain. Add a policy: **Allow** → emails you choose
   (yours, plus any teammates as viewers).
3. Add a second policy on the path `/api/webhooks/shopify` → **Bypass** →
   Everyone (that route authenticates by HMAC, not by login).
4. Copy the application **Audience (AUD)** tag into `ACCESS_AUD`.

Free tier covers this: D1 (5 GB), Pages, and Access (up to 50 users) are all
free. **This whole app runs at zero cost on Cloudflare.**

### 5 · Store poller (Module 5)
```
npx wrangler deploy          # deploys worker/poll-products.js on a 15-min cron
npx wrangler secret put INTEGRATIONS_MASTER_KEY   # same value as Pages
```

---

## Safety rails (unchanged from the Postgres design)

| Rail | Where | Effect |
|---|---|---|
| Kill switch | `settings.sending_enabled` | `false` stops every outbound message |
| Dry run | `settings.dry_run` | Renders + logs, sends nothing. **Ships enabled.** |
| Channel toggles | `settings.channels` | Email / WhatsApp disabled independently |
| Send window | `settings.send_window` | Holds messages outside 9am-9pm Asia/Dubai |
| Meta gate | `templates.meta_template_status` | WhatsApp won't send on an unapproved template |
| Idempotency | `webhook_events.shopify_id` UNIQUE | Shopify retries can't double-message |
| Audit log | `message_log` | Every send/suppress/fail, masked recipient |
| Secrets | AES-256-GCM in D1 | Key only in Cloudflare env; write-only from the UI |

`dry_run` ships `true`. The first real customer message goes out when Fares
turns it off — not when a deploy succeeds.
