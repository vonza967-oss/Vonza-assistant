create table if not exists public.agent_action_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  package_key text not null,
  request_type text not null,
  status text not null default 'new',
  visitor_session_key text,
  conversation_source text,
  display_mode text,
  guest_context jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  source_message text,
  staff_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  accepted_at timestamptz,
  done_at timestamptz,
  dismissed_at timestamptz,
  constraint agent_action_requests_status_check
    check (status in ('new', 'accepted', 'done', 'dismissed')),
  constraint agent_action_requests_package_key_check
    check (package_key in ('front_desk_general', 'hotel_concierge')),
  constraint agent_action_requests_request_type_nonblank_check
    check (length(btrim(request_type)) > 0)
);

create index if not exists agent_action_requests_owner_created_idx
  on public.agent_action_requests (owner_user_id, created_at desc);

create index if not exists agent_action_requests_agent_created_idx
  on public.agent_action_requests (agent_id, created_at desc);

create index if not exists agent_action_requests_owner_status_created_idx
  on public.agent_action_requests (owner_user_id, status, created_at desc);

create index if not exists agent_action_requests_package_type_created_idx
  on public.agent_action_requests (package_key, request_type, created_at desc);

alter table public.agent_action_requests enable row level security;

drop policy if exists "Owners can read action requests." on public.agent_action_requests;
create policy "Owners can read action requests."
  on public.agent_action_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
