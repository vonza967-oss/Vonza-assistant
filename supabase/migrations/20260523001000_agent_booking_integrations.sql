-- Legacy source: db/agent_booking_integrations.sql

create table if not exists public.agent_booking_integrations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  owner_user_id uuid not null,
  provider text not null default 'calendly',
  status text not null default 'pending',
  booking_url text,
  webhook_endpoint_token_hash text not null,
  webhook_secret_encrypted text,
  provider_account_id text,
  provider_event_type_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_booking_integrations_provider_check
    check (provider in ('calendly')),
  constraint agent_booking_integrations_status_check
    check (status in ('pending', 'active', 'disabled', 'needs_attention'))
);

create unique index if not exists agent_booking_integrations_endpoint_token_idx
  on public.agent_booking_integrations (webhook_endpoint_token_hash);

create unique index if not exists agent_booking_integrations_agent_provider_idx
  on public.agent_booking_integrations (agent_id, owner_user_id, provider);

create index if not exists agent_booking_integrations_agent_owner_idx
  on public.agent_booking_integrations (agent_id, owner_user_id);

create index if not exists agent_booking_integrations_provider_status_idx
  on public.agent_booking_integrations (provider, status);

create index if not exists agent_booking_integrations_provider_account_idx
  on public.agent_booking_integrations (provider, provider_account_id)
  where provider_account_id is not null;

create index if not exists agent_booking_integrations_event_type_idx
  on public.agent_booking_integrations (provider, provider_event_type_id)
  where provider_event_type_id is not null;

alter table public.agent_booking_integrations enable row level security;

drop policy if exists "Owners can manage booking integrations." on public.agent_booking_integrations;
create policy "Owners can manage booking integrations."
  on public.agent_booking_integrations
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
