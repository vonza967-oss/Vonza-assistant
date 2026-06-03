create table if not exists public.connected_app_inbound_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  connection_id uuid not null references public.connected_app_connections (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  provider text not null,
  app_key text not null,
  capability_key text,
  provider_event_id text,
  provider_event_type text,
  provider_message_id text,
  provider_timestamp timestamptz,
  source_account_id text,
  source_channel_id text,
  event_direction text not null default 'inbound',
  event_status text not null default 'received',
  normalized jsonb not null default '{}'::jsonb,
  redaction_summary jsonb not null default '{}'::jsonb,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint connected_app_inbound_events_direction_check
    check (event_direction in ('inbound')),
  constraint connected_app_inbound_events_status_check
    check (event_status in ('received', 'ignored', 'duplicate', 'invalid')),
  constraint connected_app_inbound_events_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint connected_app_inbound_events_app_key_nonblank_check
    check (length(btrim(app_key)) > 0),
  constraint connected_app_inbound_events_capability_key_nonblank_check
    check (capability_key is null or length(btrim(capability_key)) > 0),
  constraint connected_app_inbound_events_provider_event_id_nonblank_check
    check (provider_event_id is null or length(btrim(provider_event_id)) > 0),
  constraint connected_app_inbound_events_provider_event_type_nonblank_check
    check (provider_event_type is null or length(btrim(provider_event_type)) > 0),
  constraint connected_app_inbound_events_provider_message_id_nonblank_check
    check (provider_message_id is null or length(btrim(provider_message_id)) > 0),
  constraint connected_app_inbound_events_source_account_id_nonblank_check
    check (source_account_id is null or length(btrim(source_account_id)) > 0),
  constraint connected_app_inbound_events_source_channel_id_nonblank_check
    check (source_channel_id is null or length(btrim(source_channel_id)) > 0),
  constraint connected_app_inbound_events_dedupe_key_nonblank_check
    check (dedupe_key is null or length(btrim(dedupe_key)) > 0)
);

create unique index if not exists connected_app_inbound_events_owner_provider_dedupe_idx
  on public.connected_app_inbound_events (owner_user_id, provider, dedupe_key)
  where dedupe_key is not null;

create index if not exists connected_app_inbound_events_owner_created_idx
  on public.connected_app_inbound_events (owner_user_id, created_at desc);

create index if not exists connected_app_inbound_events_connection_created_idx
  on public.connected_app_inbound_events (connection_id, created_at desc);

create index if not exists connected_app_inbound_events_provider_event_idx
  on public.connected_app_inbound_events (provider, app_key, provider_event_type, created_at desc);

create index if not exists connected_app_inbound_events_provider_message_idx
  on public.connected_app_inbound_events (provider, provider_message_id)
  where provider_message_id is not null;

alter table public.connected_app_inbound_events enable row level security;

drop policy if exists "Owners can read connected app inbound events." on public.connected_app_inbound_events;
create policy "Owners can read connected app inbound events."
  on public.connected_app_inbound_events
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
