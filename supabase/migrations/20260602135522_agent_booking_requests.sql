create table if not exists public.agent_booking_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  visitor_session_key text,
  source_message_id uuid,
  source_channel text,
  display_mode text,
  requested_service text,
  requested_time_text text,
  requested_time_window_start timestamptz,
  requested_time_window_end timestamptz,
  timezone text,
  customer_name text,
  customer_email text,
  customer_phone text,
  status text not null default 'request_received',
  status_reason text,
  staff_notes text,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_booking_requests_status_check
    check (status in (
      'request_received',
      'needs_info',
      'needs_staff_review',
      'offered',
      'confirmed_externally',
      'declined',
      'cancel_requested',
      'reschedule_requested',
      'cancelled_externally',
      'expired'
    )),
  constraint agent_booking_requests_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint agent_booking_requests_idempotency_key_nonblank_check
    check (idempotency_key is null or length(btrim(idempotency_key)) > 0)
);

create unique index if not exists agent_booking_requests_owner_agent_idempotency_idx
  on public.agent_booking_requests (owner_user_id, agent_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists agent_booking_requests_owner_created_idx
  on public.agent_booking_requests (owner_user_id, created_at desc);

create index if not exists agent_booking_requests_agent_created_idx
  on public.agent_booking_requests (agent_id, created_at desc);

create index if not exists agent_booking_requests_owner_status_created_idx
  on public.agent_booking_requests (owner_user_id, status, created_at desc);

create index if not exists agent_booking_requests_agent_status_created_idx
  on public.agent_booking_requests (agent_id, status, created_at desc);

alter table public.agent_booking_requests enable row level security;

drop policy if exists "Owners can read booking requests." on public.agent_booking_requests;
create policy "Owners can read booking requests."
  on public.agent_booking_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
