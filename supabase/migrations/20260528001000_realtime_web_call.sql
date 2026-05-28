alter table public.web_call_sessions
  add column if not exists realtime_mode text,
  add column if not exists realtime_connection_latency_ms integer,
  add column if not exists realtime_first_audio_latency_ms integer,
  add column if not exists realtime_interruption_count integer not null default 0,
  add column if not exists realtime_reconnect_count integer not null default 0,
  add column if not exists realtime_fallback_reason text;

alter table public.web_call_sessions
  drop constraint if exists web_call_sessions_realtime_mode_check;

alter table public.web_call_sessions
  add constraint web_call_sessions_realtime_mode_check
    check (realtime_mode is null or realtime_mode in ('realtime', 'turn_based', 'fallback'));
