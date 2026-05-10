create table if not exists public.agent_visitor_reply_feedback (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  install_id text,
  session_key text not null,
  assistant_message_key text not null,
  rating text not null,
  message_context jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  constraint agent_visitor_reply_feedback_rating_check
    check (rating in ('helpful', 'not_helpful'))
);

create unique index if not exists agent_visitor_reply_feedback_message_idx
  on public.agent_visitor_reply_feedback (agent_id, session_key, assistant_message_key);

create index if not exists agent_visitor_reply_feedback_agent_created_idx
  on public.agent_visitor_reply_feedback (agent_id, created_at desc);

alter table public.agent_visitor_reply_feedback enable row level security;

drop policy if exists "Owners can read reply feedback for their agents." on public.agent_visitor_reply_feedback;
create policy "Owners can read reply feedback for their agents."
  on public.agent_visitor_reply_feedback
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_visitor_reply_feedback.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );
