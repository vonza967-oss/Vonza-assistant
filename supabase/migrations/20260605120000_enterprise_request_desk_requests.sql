create table if not exists public.enterprise_request_desk_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  source_key_hash text,
  lane text not null default 'general_enquiry',
  lane_label text not null default 'Általános érdeklődés',
  confidence text not null default 'low',
  request_text text,
  site_or_object text,
  location_text text,
  service_need text,
  timing_text text,
  urgency text,
  contact_name text,
  contact_email text,
  contact_phone text,
  missing_fields text[] not null default '{}'::text[],
  structured_brief jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'request_received',
  staff_notes text,
  status_reason text,
  idempotency_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint enterprise_request_desk_requests_lane_check
    check (lane in (
      'security_guarding',
      'reception_object_protection',
      'facility_management',
      'security_technology',
      'audit_compliance',
      'mixed_enterprise_request',
      'general_enquiry'
    )),
  constraint enterprise_request_desk_requests_confidence_check
    check (confidence in ('high', 'medium', 'low')),
  constraint enterprise_request_desk_requests_status_check
    check (status in (
      'request_received',
      'needs_info',
      'needs_staff_review',
      'routed',
      'declined',
      'archived'
    )),
  constraint enterprise_request_desk_requests_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint enterprise_request_desk_requests_idempotency_key_nonblank_check
    check (idempotency_key is null or length(btrim(idempotency_key)) > 0),
  constraint enterprise_request_desk_requests_missing_fields_check
    check (
      missing_fields <@ array[
        'service_need',
        'location_or_site',
        'urgency_or_timing',
        'contact_need'
      ]::text[]
    )
);

create unique index if not exists enterprise_request_desk_requests_owner_agent_idempotency_idx
  on public.enterprise_request_desk_requests (owner_user_id, agent_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists enterprise_request_desk_requests_owner_created_idx
  on public.enterprise_request_desk_requests (owner_user_id, created_at desc);

create index if not exists enterprise_request_desk_requests_agent_created_idx
  on public.enterprise_request_desk_requests (agent_id, created_at desc);

create index if not exists enterprise_request_desk_requests_owner_status_created_idx
  on public.enterprise_request_desk_requests (owner_user_id, status, created_at desc);

create index if not exists enterprise_request_desk_requests_agent_status_created_idx
  on public.enterprise_request_desk_requests (agent_id, status, created_at desc);

create index if not exists enterprise_request_desk_requests_owner_lane_created_idx
  on public.enterprise_request_desk_requests (owner_user_id, lane, created_at desc);

alter table public.enterprise_request_desk_requests enable row level security;

revoke all on table public.enterprise_request_desk_requests from anon;
grant select on table public.enterprise_request_desk_requests to authenticated;

drop policy if exists "Owners can read Enterprise Request Desk requests." on public.enterprise_request_desk_requests;
create policy "Owners can read Enterprise Request Desk requests."
  on public.enterprise_request_desk_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
