alter table public.agent_visitor_reply_feedback
  add column if not exists owner_user_id uuid,
  add column if not exists reason text,
  add column if not exists note text,
  add column if not exists user_question text,
  add column if not exists assistant_answer text,
  add column if not exists display_mode text,
  add column if not exists source_route text,
  add column if not exists source_type text not null default 'visitor_feedback',
  add column if not exists status text not null default 'new',
  add column if not exists training_item_id uuid,
  add column if not exists updated_at timestamp with time zone default now();

alter table public.agent_visitor_reply_feedback
  drop constraint if exists agent_visitor_reply_feedback_reason_check;

alter table public.agent_visitor_reply_feedback
  add constraint agent_visitor_reply_feedback_reason_check
    check (reason is null or reason in ('incorrect', 'missing_details', 'too_vague', 'did_not_answer', 'other'));

alter table public.agent_visitor_reply_feedback
  drop constraint if exists agent_visitor_reply_feedback_source_type_check;

alter table public.agent_visitor_reply_feedback
  add constraint agent_visitor_reply_feedback_source_type_check
    check (source_type in ('visitor_feedback', 'owner_feedback', 'test'));

alter table public.agent_visitor_reply_feedback
  drop constraint if exists agent_visitor_reply_feedback_status_check;

alter table public.agent_visitor_reply_feedback
  add constraint agent_visitor_reply_feedback_status_check
    check (status in ('new', 'queued', 'resolved', 'ignored'));

create index if not exists agent_visitor_reply_feedback_agent_status_idx
  on public.agent_visitor_reply_feedback (agent_id, status, created_at desc);

create index if not exists agent_visitor_reply_feedback_training_item_idx
  on public.agent_visitor_reply_feedback (training_item_id)
  where training_item_id is not null;

update public.agent_visitor_reply_feedback
set owner_user_id = agents.owner_user_id
from public.agents
where agent_visitor_reply_feedback.agent_id = agents.id
  and agent_visitor_reply_feedback.owner_user_id is null;

drop policy if exists "Owners can manage reply feedback for their agents." on public.agent_visitor_reply_feedback;
create policy "Owners can manage reply feedback for their agents."
  on public.agent_visitor_reply_feedback
  for all
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_visitor_reply_feedback.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_visitor_reply_feedback.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );
