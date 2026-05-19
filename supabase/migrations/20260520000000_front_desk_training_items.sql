create table if not exists public.front_desk_training_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  agent_id uuid references public.agents (id) on delete cascade,
  type text not null default 'approved_answer',
  title text,
  trigger_text text,
  answer_text text,
  tags jsonb not null default '[]'::jsonb,
  source_type text not null default 'manual',
  source_message_id uuid,
  status text not null default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint front_desk_training_items_type_check
    check (type in ('approved_answer', 'correction', 'business_fact')),
  constraint front_desk_training_items_source_type_check
    check (source_type in ('manual', 'conversation', 'website', 'test')),
  constraint front_desk_training_items_status_check
    check (status in ('active', 'draft', 'archived'))
);

create index if not exists front_desk_training_items_agent_owner_status_idx
  on public.front_desk_training_items (agent_id, owner_id, status);

create index if not exists front_desk_training_items_agent_type_status_idx
  on public.front_desk_training_items (agent_id, type, status);

alter table public.front_desk_training_items enable row level security;

drop policy if exists "Owners can manage Front Desk training items." on public.front_desk_training_items;
create policy "Owners can manage Front Desk training items."
  on public.front_desk_training_items
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));
