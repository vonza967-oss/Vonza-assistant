alter table public.messages
  add column if not exists session_key text,
  add column if not exists visitor_identity_mode text,
  add column if not exists visitor_email text,
  add column if not exists visitor_name text;

create index if not exists messages_agent_id_session_key_created_at_idx
  on public.messages (agent_id, session_key, created_at desc);

create index if not exists messages_agent_id_visitor_email_created_at_idx
  on public.messages (agent_id, visitor_email, created_at desc)
  where visitor_email is not null;
