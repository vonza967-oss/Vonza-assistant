-- Follow-up for existing production databases where
-- 20260404000200_messages_visitor_identity.sql already ran before these
-- durable visitor identity fields were added.

alter table public.messages
  add column if not exists visitor_identity_mode text,
  add column if not exists visitor_email text,
  add column if not exists visitor_name text;

create index if not exists messages_agent_id_visitor_email_created_at_idx
  on public.messages (agent_id, visitor_email, created_at desc)
  where visitor_email is not null;
