create table if not exists public.connected_app_inbound_threads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  connection_id uuid not null references public.connected_app_connections (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  provider text not null,
  app_key text not null,
  capability_key text,
  external_thread_key_hash text not null,
  external_thread_label text not null,
  status text not null default 'open',
  last_event_id uuid references public.connected_app_inbound_events (id) on delete set null,
  last_event_at timestamptz,
  last_event_type text,
  last_message_type text,
  unread_count integer not null default 0,
  assigned_owner_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint connected_app_inbound_threads_status_check
    check (status in ('open', 'reviewing', 'resolved', 'ignored', 'archived')),
  constraint connected_app_inbound_threads_unread_count_check
    check (unread_count >= 0),
  constraint connected_app_inbound_threads_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint connected_app_inbound_threads_app_key_nonblank_check
    check (length(btrim(app_key)) > 0),
  constraint connected_app_inbound_threads_capability_key_nonblank_check
    check (capability_key is null or length(btrim(capability_key)) > 0),
  constraint connected_app_inbound_threads_external_key_hash_nonblank_check
    check (length(btrim(external_thread_key_hash)) > 0),
  constraint connected_app_inbound_threads_external_label_nonblank_check
    check (length(btrim(external_thread_label)) > 0),
  constraint connected_app_inbound_threads_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint connected_app_inbound_threads_last_event_type_nonblank_check
    check (last_event_type is null or length(btrim(last_event_type)) > 0),
  constraint connected_app_inbound_threads_last_message_type_nonblank_check
    check (last_message_type is null or length(btrim(last_message_type)) > 0)
);

create unique index if not exists connected_app_inbound_threads_owner_external_idx
  on public.connected_app_inbound_threads (
    owner_user_id,
    connection_id,
    provider,
    app_key,
    coalesce(capability_key, ''),
    coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    external_thread_key_hash
  );

create index if not exists connected_app_inbound_threads_owner_status_last_idx
  on public.connected_app_inbound_threads (owner_user_id, status, last_event_at desc);

create index if not exists connected_app_inbound_threads_connection_last_idx
  on public.connected_app_inbound_threads (connection_id, last_event_at desc);

create index if not exists connected_app_inbound_threads_owner_agent_status_idx
  on public.connected_app_inbound_threads (owner_user_id, agent_id, status, last_event_at desc)
  where agent_id is not null;

alter table public.connected_app_inbound_events
  add column if not exists thread_id uuid;

create index if not exists connected_app_inbound_events_thread_created_idx
  on public.connected_app_inbound_events (thread_id, created_at desc)
  where thread_id is not null;

alter table public.connected_app_inbound_threads enable row level security;

revoke all on table public.connected_app_inbound_threads from anon;
grant select on table public.connected_app_inbound_threads to authenticated;

drop policy if exists "Owners can read connected app inbound threads." on public.connected_app_inbound_threads;
create policy "Owners can read connected app inbound threads."
  on public.connected_app_inbound_threads
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
