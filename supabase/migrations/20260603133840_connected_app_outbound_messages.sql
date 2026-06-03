create table if not exists public.connected_app_outbound_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  connection_id uuid not null references public.connected_app_connections (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  thread_id uuid not null references public.connected_app_inbound_threads (id) on delete cascade,
  provider text not null,
  app_key text not null,
  capability_key text not null,
  destination_ref_hash text not null,
  message_type text not null,
  body_redacted text,
  template_name text,
  template_language text,
  status text not null default 'blocked',
  approval_mode text not null default 'manual_staff',
  provider_message_id text,
  provider_status text,
  error_code text,
  error_message_redacted text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_owner_user_id uuid not null,
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint connected_app_outbound_messages_message_type_check
    check (message_type in ('text', 'template')),
  constraint connected_app_outbound_messages_status_check
    check (status in ('draft', 'queued', 'sent', 'failed', 'blocked')),
  constraint connected_app_outbound_messages_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint connected_app_outbound_messages_app_key_nonblank_check
    check (length(btrim(app_key)) > 0),
  constraint connected_app_outbound_messages_capability_key_nonblank_check
    check (length(btrim(capability_key)) > 0),
  constraint connected_app_outbound_messages_destination_ref_hash_nonblank_check
    check (length(btrim(destination_ref_hash)) > 0),
  constraint connected_app_outbound_messages_message_type_nonblank_check
    check (length(btrim(message_type)) > 0),
  constraint connected_app_outbound_messages_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint connected_app_outbound_messages_approval_mode_nonblank_check
    check (length(btrim(approval_mode)) > 0),
  constraint connected_app_outbound_messages_template_name_nonblank_check
    check (template_name is null or length(btrim(template_name)) > 0),
  constraint connected_app_outbound_messages_template_language_nonblank_check
    check (template_language is null or length(btrim(template_language)) > 0),
  constraint connected_app_outbound_messages_provider_message_id_nonblank_check
    check (provider_message_id is null or length(btrim(provider_message_id)) > 0),
  constraint connected_app_outbound_messages_provider_status_nonblank_check
    check (provider_status is null or length(btrim(provider_status)) > 0),
  constraint connected_app_outbound_messages_error_code_nonblank_check
    check (error_code is null or length(btrim(error_code)) > 0),
  constraint connected_app_outbound_messages_error_message_redacted_nonblank_check
    check (error_message_redacted is null or length(btrim(error_message_redacted)) > 0)
);

create index if not exists connected_app_outbound_messages_owner_created_idx
  on public.connected_app_outbound_messages (owner_user_id, created_at desc);

create index if not exists connected_app_outbound_messages_thread_created_idx
  on public.connected_app_outbound_messages (thread_id, created_at desc);

create index if not exists connected_app_outbound_messages_connection_status_idx
  on public.connected_app_outbound_messages (connection_id, status, created_at desc);

create index if not exists connected_app_outbound_messages_owner_agent_created_idx
  on public.connected_app_outbound_messages (owner_user_id, agent_id, created_at desc)
  where agent_id is not null;

alter table public.connected_app_outbound_messages enable row level security;

revoke all on table public.connected_app_outbound_messages from anon;
grant select on table public.connected_app_outbound_messages to authenticated;

drop policy if exists "Owners can read connected app outbound messages." on public.connected_app_outbound_messages;
create policy "Owners can read connected app outbound messages."
  on public.connected_app_outbound_messages
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
