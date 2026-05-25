create table if not exists public.agent_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null,
  provider text not null default 'twilio',
  phone_number_e164 text not null,
  label text,
  status text not null default 'pending',
  phone_channel_enabled boolean not null default false,
  greeting_text text,
  disclosure_text text,
  fallback_mode text not null default 'callback_only',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_phone_numbers_provider_check
    check (provider in ('twilio')),
  constraint agent_phone_numbers_status_check
    check (status in ('pending', 'active', 'disabled')),
  constraint agent_phone_numbers_fallback_mode_check
    check (fallback_mode in ('callback_only'))
);

create unique index if not exists agent_phone_numbers_provider_number_idx
  on public.agent_phone_numbers (provider, phone_number_e164);

create index if not exists agent_phone_numbers_agent_owner_idx
  on public.agent_phone_numbers (agent_id, owner_user_id);

create index if not exists agent_phone_numbers_owner_status_idx
  on public.agent_phone_numbers (owner_user_id, status);

create table if not exists public.agent_phone_call_sessions (
  id uuid primary key default gen_random_uuid(),
  phone_number_id uuid not null references public.agent_phone_numbers (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null,
  provider text not null default 'twilio',
  provider_call_sid text not null,
  caller_phone_e164 text,
  called_phone_e164 text,
  status text not null default 'started',
  block_reason text,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_phone_call_sessions_provider_check
    check (provider in ('twilio')),
  constraint agent_phone_call_sessions_status_check
    check (status in ('started', 'greeting', 'completed', 'failed', 'blocked'))
);

create unique index if not exists agent_phone_call_sessions_provider_sid_idx
  on public.agent_phone_call_sessions (provider, provider_call_sid);

create index if not exists agent_phone_call_sessions_phone_number_idx
  on public.agent_phone_call_sessions (phone_number_id, started_at desc);

create index if not exists agent_phone_call_sessions_agent_owner_idx
  on public.agent_phone_call_sessions (agent_id, owner_user_id, started_at desc);

create index if not exists agent_phone_call_sessions_caller_idx
  on public.agent_phone_call_sessions (caller_phone_e164, started_at desc)
  where caller_phone_e164 is not null;

alter table public.agent_phone_numbers enable row level security;
alter table public.agent_phone_call_sessions enable row level security;

drop policy if exists "Owners can manage phone numbers." on public.agent_phone_numbers;
create policy "Owners can manage phone numbers."
  on public.agent_phone_numbers
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage phone call sessions." on public.agent_phone_call_sessions;
create policy "Owners can manage phone call sessions."
  on public.agent_phone_call_sessions
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
