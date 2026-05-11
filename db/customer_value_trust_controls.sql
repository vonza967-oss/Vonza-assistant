create table if not exists public.agent_human_follow_up_statuses (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  item_key text not null,
  action_key text,
  follow_up_id uuid references public.agent_follow_up_workflows (id) on delete set null,
  knowledge_fix_id uuid references public.agent_knowledge_fix_workflows (id) on delete set null,
  status text not null default 'new',
  note text,
  owner_reply text,
  follow_up_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_human_follow_up_statuses_status_check
    check (status in ('new', 'reviewing', 'replied', 'follow_up_later', 'dismissed'))
);

create unique index if not exists agent_human_follow_up_statuses_item_idx
  on public.agent_human_follow_up_statuses (agent_id, owner_user_id, item_key);

create index if not exists agent_human_follow_up_statuses_owner_status_idx
  on public.agent_human_follow_up_statuses (agent_id, owner_user_id, status, updated_at desc);

create table if not exists public.agent_owner_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  dedupe_key text not null,
  type text not null,
  title text not null,
  reason text,
  related_action_key text,
  related_follow_up_id uuid references public.agent_follow_up_workflows (id) on delete set null,
  related_knowledge_fix_id uuid references public.agent_knowledge_fix_workflows (id) on delete set null,
  recommended_next_action text,
  status text not null default 'unread',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_owner_notifications_type_check
    check (type in ('high_intent_lead', 'unhappy_customer', 'not_helpful_ai_reply', 'repeated_unanswered_question')),
  constraint agent_owner_notifications_status_check
    check (status in ('unread', 'read', 'dismissed'))
);

create unique index if not exists agent_owner_notifications_dedupe_idx
  on public.agent_owner_notifications (agent_id, owner_user_id, dedupe_key);

create index if not exists agent_owner_notifications_owner_status_idx
  on public.agent_owner_notifications (agent_id, owner_user_id, status, updated_at desc);

create table if not exists public.agent_privacy_settings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  retention_days integer not null default 365,
  delete_unidentified_visitors_after_days integer not null default 90,
  policy_note text,
  widget_identity_guidance text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_privacy_settings_retention_check
    check (retention_days > 0 and delete_unidentified_visitors_after_days > 0)
);

create unique index if not exists agent_privacy_settings_agent_owner_idx
  on public.agent_privacy_settings (agent_id, owner_user_id);

alter table public.agent_human_follow_up_statuses enable row level security;
alter table public.agent_owner_notifications enable row level security;
alter table public.agent_privacy_settings enable row level security;

drop policy if exists "Owners can manage human follow-up statuses." on public.agent_human_follow_up_statuses;
create policy "Owners can manage human follow-up statuses."
  on public.agent_human_follow_up_statuses
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Owners can manage owner notifications." on public.agent_owner_notifications;
create policy "Owners can manage owner notifications."
  on public.agent_owner_notifications
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Owners can manage privacy settings." on public.agent_privacy_settings;
create policy "Owners can manage privacy settings."
  on public.agent_privacy_settings
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
