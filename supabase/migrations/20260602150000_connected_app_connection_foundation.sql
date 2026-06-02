create table if not exists public.connected_app_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  provider text not null,
  app_key text not null,
  capability_keys text[] not null default '{}'::text[],
  status text not null default 'needs_setup',
  provider_account_id text,
  provider_account_label text,
  scopes_granted text[] not null default '{}'::text[],
  webhook_status text,
  token_secret_ref text,
  last_verified_at timestamptz,
  needs_attention_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint connected_app_connections_status_check
    check (status in ('needs_setup', 'active', 'disabled', 'needs_attention', 'revoked')),
  constraint connected_app_connections_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint connected_app_connections_app_key_nonblank_check
    check (length(btrim(app_key)) > 0),
  constraint connected_app_connections_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint connected_app_connections_provider_account_id_nonblank_check
    check (provider_account_id is null or length(btrim(provider_account_id)) > 0),
  constraint connected_app_connections_token_secret_ref_nonblank_check
    check (token_secret_ref is null or length(btrim(token_secret_ref)) > 0)
);

create unique index if not exists connected_app_connections_owner_provider_app_account_idx
  on public.connected_app_connections (owner_user_id, provider, app_key, provider_account_id)
  where provider_account_id is not null;

create index if not exists connected_app_connections_owner_status_idx
  on public.connected_app_connections (owner_user_id, status, updated_at desc);

create index if not exists connected_app_connections_provider_app_status_idx
  on public.connected_app_connections (provider, app_key, status);

create table if not exists public.agent_connected_app_enablements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  connection_id uuid not null references public.connected_app_connections (id) on delete cascade,
  capability_keys text[] not null default '{}'::text[],
  enabled boolean not null default false,
  approval_mode text not null default 'manual_review',
  allowed_surfaces text[] not null default '{}'::text[],
  package_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_connected_app_enablements_approval_mode_check
    check (approval_mode in ('manual_review', 'owner_approved', 'automatic_internal', 'disabled')),
  constraint agent_connected_app_enablements_approval_mode_nonblank_check
    check (length(btrim(approval_mode)) > 0),
  constraint agent_connected_app_enablements_package_key_nonblank_check
    check (package_key is null or length(btrim(package_key)) > 0)
);

create index if not exists agent_connected_app_enablements_owner_agent_idx
  on public.agent_connected_app_enablements (owner_user_id, agent_id, updated_at desc);

create index if not exists agent_connected_app_enablements_agent_connection_idx
  on public.agent_connected_app_enablements (agent_id, connection_id);

create index if not exists agent_connected_app_enablements_connection_idx
  on public.agent_connected_app_enablements (connection_id);

create index if not exists agent_connected_app_enablements_owner_enabled_idx
  on public.agent_connected_app_enablements (owner_user_id, enabled, updated_at desc);

alter table public.connected_app_connections enable row level security;
alter table public.agent_connected_app_enablements enable row level security;

drop policy if exists "Owners can read connected app connections." on public.connected_app_connections;
create policy "Owners can read connected app connections."
  on public.connected_app_connections
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read connected app enablements." on public.agent_connected_app_enablements;
create policy "Owners can read connected app enablements."
  on public.agent_connected_app_enablements
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
