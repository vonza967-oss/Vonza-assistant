create table if not exists public.web_call_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null,
  client_session_key text not null,
  visitor_session_key text,
  display_mode text not null default 'page',
  status text not null default 'started',
  turn_count integer not null default 0,
  duration_seconds integer,
  failure_category text,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  last_event_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint web_call_sessions_display_mode_check
    check (display_mode in ('page')),
  constraint web_call_sessions_status_check
    check (status in ('started', 'active', 'completed', 'failed'))
);

create unique index if not exists web_call_sessions_agent_client_key_idx
  on public.web_call_sessions (agent_id, client_session_key);

create index if not exists web_call_sessions_agent_owner_started_idx
  on public.web_call_sessions (agent_id, owner_user_id, started_at desc);

create index if not exists web_call_sessions_owner_started_idx
  on public.web_call_sessions (owner_user_id, started_at desc);

create table if not exists public.web_call_turn_telemetry (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.web_call_sessions (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null,
  turn_index integer not null,
  status text not null default 'active',
  recording_duration_ms integer,
  upload_latency_ms integer,
  transcription_latency_ms integer,
  assistant_response_latency_ms integer,
  tts_generation_latency_ms integer,
  playback_start_latency_ms integer,
  total_turn_latency_ms integer,
  audio_duration_seconds numeric,
  audio_bytes integer,
  failure_category text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint web_call_turn_telemetry_turn_index_check
    check (turn_index > 0),
  constraint web_call_turn_telemetry_status_check
    check (status in ('active', 'completed', 'failed'))
);

create unique index if not exists web_call_turn_telemetry_session_turn_idx
  on public.web_call_turn_telemetry (session_id, turn_index);

create index if not exists web_call_turn_telemetry_agent_owner_idx
  on public.web_call_turn_telemetry (agent_id, owner_user_id, created_at desc);

alter table public.messages
  add column if not exists web_call_session_id uuid references public.web_call_sessions (id) on delete set null;

create index if not exists messages_web_call_session_id_idx
  on public.messages (web_call_session_id)
  where web_call_session_id is not null;

alter table public.product_events
  add column if not exists web_call_session_id uuid references public.web_call_sessions (id) on delete set null;

create index if not exists product_events_web_call_session_id_idx
  on public.product_events (web_call_session_id)
  where web_call_session_id is not null;

alter table public.web_call_sessions enable row level security;
alter table public.web_call_turn_telemetry enable row level security;

drop policy if exists "Owners can manage Web Call sessions." on public.web_call_sessions;
create policy "Owners can manage Web Call sessions."
  on public.web_call_sessions
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage Web Call turn telemetry." on public.web_call_turn_telemetry;
create policy "Owners can manage Web Call turn telemetry."
  on public.web_call_turn_telemetry
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
