create table if not exists public.agent_order_support_settings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  connection_id uuid references public.connected_app_connections (id) on delete set null,
  enabled boolean not null default false,
  provider text not null default 'internal',
  provider_status text not null default 'needs_setup',
  supported_actions text[] not null default array['order_lookup', 'shipping_tracking']::text[],
  approval_mode text not null default 'read_only',
  escalation_destination text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_order_support_settings_provider_check
    check (provider in ('internal', 'shopify', 'woocommerce')),
  constraint agent_order_support_settings_provider_status_check
    check (provider_status in ('not_connected', 'connected', 'needs_setup', 'needs_attention', 'disabled')),
  constraint agent_order_support_settings_approval_mode_check
    check (approval_mode in ('read_only', 'change_requests', 'safe_automatic')),
  constraint agent_order_support_settings_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint agent_order_support_settings_provider_status_nonblank_check
    check (length(btrim(provider_status)) > 0),
  constraint agent_order_support_settings_approval_mode_nonblank_check
    check (length(btrim(approval_mode)) > 0),
  constraint agent_order_support_settings_escalation_nonblank_check
    check (escalation_destination is null or length(btrim(escalation_destination)) > 0)
);

create unique index if not exists agent_order_support_settings_owner_agent_idx
  on public.agent_order_support_settings (owner_user_id, agent_id);

create index if not exists agent_order_support_settings_owner_enabled_idx
  on public.agent_order_support_settings (owner_user_id, enabled, updated_at desc);

create index if not exists agent_order_support_settings_connection_idx
  on public.agent_order_support_settings (connection_id)
  where connection_id is not null;

create table if not exists public.commerce_order_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null default 'internal',
  provider_account_id text,
  external_order_id text not null,
  order_number text not null,
  customer_email text,
  customer_phone text,
  financial_status text,
  fulfillment_status text,
  shipping_status text,
  tracking_number text,
  tracking_url text,
  carrier text,
  order_status_url text,
  currency text,
  total_amount_minor integer,
  items_summary jsonb not null default '[]'::jsonb,
  shipping_address_summary text,
  contact_email text,
  contact_phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint commerce_order_snapshots_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint commerce_order_snapshots_external_order_id_nonblank_check
    check (length(btrim(external_order_id)) > 0),
  constraint commerce_order_snapshots_order_number_nonblank_check
    check (length(btrim(order_number)) > 0),
  constraint commerce_order_snapshots_total_amount_minor_check
    check (total_amount_minor is null or total_amount_minor >= 0)
);

create unique index if not exists commerce_order_snapshots_owner_provider_external_idx
  on public.commerce_order_snapshots (owner_user_id, provider, external_order_id);

create index if not exists commerce_order_snapshots_owner_business_order_idx
  on public.commerce_order_snapshots (owner_user_id, business_id, provider, order_number);

create index if not exists commerce_order_snapshots_business_updated_idx
  on public.commerce_order_snapshots (business_id, updated_at desc);

create table if not exists public.order_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  provider text not null default 'internal',
  external_order_id text,
  order_number_hash text,
  verification_identifier_hash text,
  visitor_session_key text,
  status text not null default 'failed',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint order_verification_sessions_status_check
    check (status in ('verified', 'failed', 'expired')),
  constraint order_verification_sessions_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint order_verification_sessions_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint order_verification_sessions_external_order_id_nonblank_check
    check (external_order_id is null or length(btrim(external_order_id)) > 0),
  constraint order_verification_sessions_order_number_hash_nonblank_check
    check (order_number_hash is null or length(btrim(order_number_hash)) > 0),
  constraint order_verification_sessions_identifier_hash_nonblank_check
    check (verification_identifier_hash is null or length(btrim(verification_identifier_hash)) > 0)
);

create index if not exists order_verification_sessions_owner_agent_created_idx
  on public.order_verification_sessions (owner_user_id, agent_id, created_at desc);

create index if not exists order_verification_sessions_owner_status_created_idx
  on public.order_verification_sessions (owner_user_id, status, created_at desc);

create index if not exists order_verification_sessions_business_created_idx
  on public.order_verification_sessions (business_id, created_at desc)
  where business_id is not null;

create table if not exists public.order_action_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  verification_session_id uuid references public.order_verification_sessions (id) on delete set null,
  provider text not null default 'internal',
  external_order_id text,
  order_number_hash text,
  action_type text not null,
  status text not null default 'pending',
  requested_change jsonb not null default '{}'::jsonb,
  customer_context jsonb not null default '{}'::jsonb,
  provider_result jsonb not null default '{}'::jsonb,
  staff_notes text,
  status_reason text,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint order_action_requests_action_type_check
    check (action_type in ('shipping_address', 'contact_info', 'cancellation', 'delivery_note', 'item_change')),
  constraint order_action_requests_status_check
    check (status in ('pending', 'needs_staff_review', 'applied', 'rejected', 'cancelled', 'failed')),
  constraint order_action_requests_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint order_action_requests_action_type_nonblank_check
    check (length(btrim(action_type)) > 0),
  constraint order_action_requests_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint order_action_requests_external_order_id_nonblank_check
    check (external_order_id is null or length(btrim(external_order_id)) > 0),
  constraint order_action_requests_order_number_hash_nonblank_check
    check (order_number_hash is null or length(btrim(order_number_hash)) > 0),
  constraint order_action_requests_idempotency_key_nonblank_check
    check (idempotency_key is null or length(btrim(idempotency_key)) > 0)
);

create unique index if not exists order_action_requests_owner_agent_idempotency_idx
  on public.order_action_requests (owner_user_id, agent_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists order_action_requests_owner_status_created_idx
  on public.order_action_requests (owner_user_id, status, created_at desc);

create index if not exists order_action_requests_agent_status_created_idx
  on public.order_action_requests (agent_id, status, created_at desc);

create index if not exists order_action_requests_verification_session_idx
  on public.order_action_requests (verification_session_id)
  where verification_session_id is not null;

create table if not exists public.order_action_audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  verification_session_id uuid references public.order_verification_sessions (id) on delete set null,
  order_action_request_id uuid references public.order_action_requests (id) on delete set null,
  provider text not null default 'internal',
  external_order_id text,
  order_number_hash text,
  event_type text not null,
  actor_type text not null default 'assistant',
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  constraint order_action_audit_logs_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint order_action_audit_logs_event_type_nonblank_check
    check (length(btrim(event_type)) > 0),
  constraint order_action_audit_logs_actor_type_nonblank_check
    check (length(btrim(actor_type)) > 0),
  constraint order_action_audit_logs_external_order_id_nonblank_check
    check (external_order_id is null or length(btrim(external_order_id)) > 0),
  constraint order_action_audit_logs_order_number_hash_nonblank_check
    check (order_number_hash is null or length(btrim(order_number_hash)) > 0)
);

create index if not exists order_action_audit_logs_owner_created_idx
  on public.order_action_audit_logs (owner_user_id, created_at desc);

create index if not exists order_action_audit_logs_agent_created_idx
  on public.order_action_audit_logs (agent_id, created_at desc);

create index if not exists order_action_audit_logs_action_request_idx
  on public.order_action_audit_logs (order_action_request_id)
  where order_action_request_id is not null;

create index if not exists order_action_audit_logs_verification_session_idx
  on public.order_action_audit_logs (verification_session_id)
  where verification_session_id is not null;

alter table public.agent_order_support_settings enable row level security;
alter table public.commerce_order_snapshots enable row level security;
alter table public.order_verification_sessions enable row level security;
alter table public.order_action_requests enable row level security;
alter table public.order_action_audit_logs enable row level security;

revoke all on table public.agent_order_support_settings from anon;
revoke all on table public.commerce_order_snapshots from anon;
revoke all on table public.order_verification_sessions from anon;
revoke all on table public.order_action_requests from anon;
revoke all on table public.order_action_audit_logs from anon;

grant select on table public.agent_order_support_settings to authenticated;
grant select on table public.commerce_order_snapshots to authenticated;
grant select on table public.order_verification_sessions to authenticated;
grant select on table public.order_action_requests to authenticated;
grant select on table public.order_action_audit_logs to authenticated;

drop policy if exists "Owners can read order support settings." on public.agent_order_support_settings;
create policy "Owners can read order support settings."
  on public.agent_order_support_settings
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read commerce order snapshots." on public.commerce_order_snapshots;
create policy "Owners can read commerce order snapshots."
  on public.commerce_order_snapshots
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read order verification sessions." on public.order_verification_sessions;
create policy "Owners can read order verification sessions."
  on public.order_verification_sessions
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read order action requests." on public.order_action_requests;
create policy "Owners can read order action requests."
  on public.order_action_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read order action audit logs." on public.order_action_audit_logs;
create policy "Owners can read order action audit logs."
  on public.order_action_audit_logs
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
