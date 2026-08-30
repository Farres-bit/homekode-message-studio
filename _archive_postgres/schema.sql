-- =====================================================================
-- HomeKode · Message Studio — Module 2 schema
-- Postgres / Supabase.  Run once in the Supabase SQL editor.
-- Every table is RLS-protected. Nothing is readable without a role.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.app_role not null default 'viewer',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per signed-in user. Fares is the only owner; owner is never self-assignable.';

-- Helper: current user's role, used by every policy below.
create or replace function public.app_role_of_current_user()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false);
$$;

-- New sign-ups always land as 'viewer'. Only the owner promotes.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'viewer')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block privilege escalation: nobody can change their own role.
create or replace function public.guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if not public.is_owner() then
      raise exception 'Only the owner can change roles.';
    end if;
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists guard_profiles_role on public.profiles;
create trigger guard_profiles_role
  before update on public.profiles
  for each row execute function public.guard_role_change();

-- ---------------------------------------------------------------------
-- 2. Templates  (the 30 authored in Module 1)
-- ---------------------------------------------------------------------
create table if not exists public.templates (
  id            text primary key,
  family        text not null check (family in ('order','returns')),
  emoji         text,
  pill          text not null,
  headline      text not null,
  body          text not null,
  whatsapp_body text not null,
  reason_set    text,
  fields        jsonb not null default '[]'::jsonb,
  full_order    boolean not null default false,
  -- Meta template name, filled in at Module 6 after approval
  meta_template_name   text,
  meta_template_status text not null default 'not_submitted'
    check (meta_template_status in ('not_submitted','pending','approved','rejected')),
  enabled       boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id)
);

create table if not exists public.reasons (
  id          bigserial primary key,
  reason_set  text not null,
  code        text not null,
  label       text not null,
  line        text not null,
  unique (reason_set, code)
);

-- ---------------------------------------------------------------------
-- 3. Settings — the kill switch and dry-run live here
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.settings (key, value) values
  ('sending_enabled', 'true'::jsonb),          -- global kill switch
  ('dry_run',         'true'::jsonb),          -- render + log, do not dispatch
  ('channels',        '{"email":true,"whatsapp":true}'::jsonb),
  ('send_window',     '{"start":"09:00","end":"21:00","tz":"Asia/Dubai"}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 4. Webhook ledger — idempotency. One Shopify action, one message.
-- ---------------------------------------------------------------------
create table if not exists public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  shopify_id    text not null unique,   -- X-Shopify-Webhook-Id
  topic         text not null,
  shop_domain   text,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  status        text not null default 'received'
    check (status in ('received','processed','skipped','failed')),
  error         text
);
create index if not exists webhook_events_received_idx on public.webhook_events (received_at desc);

-- ---------------------------------------------------------------------
-- 5. Audit log — who, what, when, to whom, which channel, result
-- ---------------------------------------------------------------------
create table if not exists public.message_log (
  id              uuid primary key default gen_random_uuid(),
  template_id     text references public.templates(id),
  reason_code     text,
  channel         text not null check (channel in ('email','whatsapp')),
  recipient       text not null,          -- masked at write time
  order_number    text,
  ticket_id       text,
  triggered_by    text not null default 'shopify_webhook',
  webhook_event   uuid references public.webhook_events(id),
  dry_run         boolean not null default false,
  status          text not null check (status in ('queued','sent','failed','suppressed')),
  provider_id     text,
  error           text,
  rendered_subject text,
  created_at      timestamptz not null default now()
);
create index if not exists message_log_created_idx on public.message_log (created_at desc);
create index if not exists message_log_order_idx  on public.message_log (order_number);

-- ---------------------------------------------------------------------
-- 6. Live Website Updates — snapshot + diff (feeds Module 5)
-- ---------------------------------------------------------------------
create table if not exists public.product_snapshots (
  handle       text primary key,
  title        text not null,
  product_type text,
  price        numeric(12,2),
  compare_at   numeric(12,2),
  available    boolean,
  image_url    text,
  updated_at   timestamptz,
  seen_at      timestamptz not null default now()
);

create table if not exists public.store_events (
  id          bigserial primary key,
  kind        text not null check (kind in
                ('new_arrival','price_drop','price_increase','back_in_stock','sold_out','collection_updated')),
  handle      text,
  title       text not null,
  detail      text,
  old_value   numeric(12,2),
  new_value   numeric(12,2),
  created_at  timestamptz not null default now()
);
create index if not exists store_events_created_idx on public.store_events (created_at desc);

-- ---------------------------------------------------------------------
-- 7. Row Level Security
--    Reads: any signed-in user.  Writes: owner/editor.  Secrets: nobody.
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.templates         enable row level security;
alter table public.reasons           enable row level security;
alter table public.settings          enable row level security;
alter table public.webhook_events    enable row level security;
alter table public.message_log       enable row level security;
alter table public.product_snapshots enable row level security;
alter table public.store_events      enable row level security;

-- profiles: you see yourself; the owner sees everyone.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_owner());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (public.is_owner()) with check (public.is_owner());

-- templates + reasons: everyone signed in reads; owner/editor writes.
drop policy if exists templates_read on public.templates;
create policy templates_read on public.templates for select
  using (auth.uid() is not null);
drop policy if exists templates_write on public.templates;
create policy templates_write on public.templates for all
  using (public.app_role_of_current_user() in ('owner','editor'))
  with check (public.app_role_of_current_user() in ('owner','editor'));

drop policy if exists reasons_read on public.reasons;
create policy reasons_read on public.reasons for select
  using (auth.uid() is not null);
drop policy if exists reasons_write on public.reasons;
create policy reasons_write on public.reasons for all
  using (public.app_role_of_current_user() in ('owner','editor'))
  with check (public.app_role_of_current_user() in ('owner','editor'));

-- settings: everyone reads; ONLY the owner flips the kill switch.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select
  using (auth.uid() is not null);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all
  using (public.is_owner()) with check (public.is_owner());

-- audit + webhooks: read-only to signed-in users, and never writable
-- from the browser. The Worker writes with the service role, which
-- bypasses RLS by design.
drop policy if exists message_log_read on public.message_log;
create policy message_log_read on public.message_log for select
  using (auth.uid() is not null);
drop policy if exists webhook_events_read on public.webhook_events;
create policy webhook_events_read on public.webhook_events for select
  using (public.is_owner());

-- store feed: readable by any signed-in user.
drop policy if exists snapshots_read on public.product_snapshots;
create policy snapshots_read on public.product_snapshots for select
  using (auth.uid() is not null);
drop policy if exists store_events_read on public.store_events;
create policy store_events_read on public.store_events for select
  using (auth.uid() is not null);

-- =====================================================================
-- After running this: sign in once, then promote yourself with
--   update public.profiles set role = 'owner' where email = '<your email>';
-- run from the SQL editor (which bypasses RLS). This is the only
-- moment an owner is created by hand — after that, the trigger blocks it.
-- =====================================================================
