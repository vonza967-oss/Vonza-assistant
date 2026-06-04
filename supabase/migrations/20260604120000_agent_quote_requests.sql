create table if not exists public.agent_quote_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  visitor_session_key text,
  source_message_id uuid,
  source_channel text,
  display_mode text,
  requested_service text,
  project_details text,
  location_text text,
  urgency text,
  budget_text text,
  customer_name text,
  customer_email text,
  customer_phone text,
  language text,
  status text not null default 'request_received',
  status_reason text,
  staff_notes text,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_quote_requests_status_check
    check (status in (
      'request_received',
      'needs_info',
      'needs_staff_review',
      'quoted_externally',
      'declined',
      'accepted_externally',
      'cancel_requested',
      'expired',
      'archived'
    )),
  constraint agent_quote_requests_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint agent_quote_requests_idempotency_key_nonblank_check
    check (idempotency_key is null or length(btrim(idempotency_key)) > 0)
);

create unique index if not exists agent_quote_requests_owner_agent_idempotency_idx
  on public.agent_quote_requests (owner_user_id, agent_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists agent_quote_requests_owner_created_idx
  on public.agent_quote_requests (owner_user_id, created_at desc);

create index if not exists agent_quote_requests_agent_created_idx
  on public.agent_quote_requests (agent_id, created_at desc);

create index if not exists agent_quote_requests_owner_status_created_idx
  on public.agent_quote_requests (owner_user_id, status, created_at desc);

create index if not exists agent_quote_requests_agent_status_created_idx
  on public.agent_quote_requests (agent_id, status, created_at desc);

alter table public.agent_quote_requests enable row level security;

revoke all on table public.agent_quote_requests from anon;
grant select on table public.agent_quote_requests to authenticated;

drop policy if exists "Owners can read quote requests." on public.agent_quote_requests;
create policy "Owners can read quote requests."
  on public.agent_quote_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
