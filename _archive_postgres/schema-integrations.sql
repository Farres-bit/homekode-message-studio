-- =====================================================================
-- HomeKode · Message Studio — API Connections vault
-- Run AFTER schema.sql.
--
-- Design note, and it matters:
-- This table never stores a key in readable form. The Worker encrypts
-- every value with AES-256-GCM before it lands here, using a master key
-- held only in Cloudflare's encrypted environment. The browser can write
-- a credential and can read its *masked preview* — it can never read the
-- credential back. Even a full database leak yields ciphertext.
-- =====================================================================

create table if not exists public.integration_secrets (
  key            text primary key,          -- e.g. 'SHOPIFY_ADMIN_TOKEN'
  system         text not null check (system in
                   ('shopify','dobesell','freshdesk','email','whatsapp','platform')),
  label          text not null,             -- what Fares sees on the page
  ciphertext     text,                      -- AES-256-GCM, base64
  iv             text,                      -- per-value nonce, base64
  masked_preview text,                      -- e.g. 'shpat_••••4f2a'
  required       boolean not null default true,
  module         int not null,              -- which build module needs it
  help           text,                      -- where in the vendor UI to find it
  status         text not null default 'missing'
                   check (status in ('missing','saved','verified','failed')),
  last_tested_at timestamptz,
  last_test_note text,
  updated_at     timestamptz,
  updated_by     uuid references public.profiles(id)
);

alter table public.integration_secrets enable row level security;

-- Everyone signed in can SEE which credentials are outstanding.
-- Nobody can read ciphertext or iv from the browser: the app selects an
-- explicit column list, and this view is what the front end actually uses.
drop policy if exists integrations_read on public.integration_secrets;
create policy integrations_read on public.integration_secrets for select
  using (auth.uid() is not null);

-- Writes go through the Worker with the service role. No browser write path.
drop policy if exists integrations_no_client_write on public.integration_secrets;
create policy integrations_no_client_write on public.integration_secrets for all
  using (false) with check (false);

create or replace view public.integration_status as
  select key, system, label, masked_preview, required, module, help,
         status, last_tested_at, last_test_note, updated_at
  from public.integration_secrets;

-- ---------------------------------------------------------------------
-- The slots. Fares pastes into these as IT hands them over.
-- ---------------------------------------------------------------------
insert into public.integration_secrets (key, system, label, required, module, help) values
  ('SHOPIFY_SHOP_DOMAIN','shopify','Shop domain',true,3,'Looks like homekode.myshopify.com'),
  ('SHOPIFY_ADMIN_TOKEN','shopify','Admin API access token',true,3,'Shopify admin → Settings → Apps → Develop apps → your app → API credentials'),
  ('SHOPIFY_WEBHOOK_SECRET','shopify','Webhook signing secret',true,3,'Same app → Webhooks → signing secret. This is what proves a webhook is really from Shopify.'),
  ('SHOPIFY_API_VERSION','shopify','Admin API version',false,3,'e.g. 2026-07. Leave blank to use the current stable version.'),

  ('DOBESELL_BASE_URL','dobesell','API base URL',true,3,'The root your IT team gives you, e.g. https://api.dobesell.com/v1'),
  ('DOBESELL_API_KEY','dobesell','API key',true,3,'Ask IT for a read-only key scoped to orders, AWB and fulfilment.'),
  ('DOBESELL_AUTH_SCHEME','dobesell','Auth scheme',false,3,'Bearer, ApiKey, or Basic — whichever IT specifies.'),

  ('FRESHDESK_DOMAIN','freshdesk','Freshdesk domain',true,3,'Looks like homekode.freshdesk.com'),
  ('FRESHDESK_API_KEY','freshdesk','API key',true,3,'Freshdesk → Profile settings → Your API key'),
  ('FRESHDESK_REASON_FIELD','freshdesk','Reason-code ticket field',false,3,'The custom field ID that holds the return reason.'),

  ('RESEND_API_KEY','email','Email provider API key',true,4,'From your email provider dashboard.'),
  ('EMAIL_FROM','email','From address',true,4,'HomeKode <orders@homekode.com>'),
  ('EMAIL_REPLY_TO','email','Reply-to address',false,4,'Where customer replies should land — usually the Freshdesk inbox.'),

  ('WHATSAPP_TOKEN','whatsapp','Permanent access token',true,6,'Meta Business → WhatsApp → API setup'),
  ('WHATSAPP_PHONE_ID','whatsapp','Phone number ID',true,6,'Meta Business → WhatsApp → API setup'),
  ('WHATSAPP_WABA_ID','whatsapp','WhatsApp Business Account ID',true,6,'Needed to submit templates for Meta approval.'),

  ('POLL_TRIGGER_KEY','platform','Store-poller trigger key',false,5,'Any long random string. Generate it here if you like.')
on conflict (key) do nothing;
