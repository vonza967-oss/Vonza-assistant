create table if not exists public.agent_activation_wizard_progress (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid not null,
  current_step text not null default 'business_basics',
  completed_steps text[] not null default '{}',
  skipped_steps text[] not null default '{}',
  exited_at timestamp with time zone,
  completed_at timestamp with time zone,
  import_status text not null default 'idle',
  import_error text,
  test_question text,
  test_quality text not null default 'unknown',
  route_target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_activation_wizard_progress_current_step_check
    check (current_step in ('business_basics', 'import_knowledge', 'configure_assistant', 'install_widget', 'test_improve')),
  constraint agent_activation_wizard_progress_import_status_check
    check (import_status in ('idle', 'running', 'success', 'limited', 'failed')),
  constraint agent_activation_wizard_progress_test_quality_check
    check (test_quality in ('unknown', 'strong', 'needs_improvement'))
);

create unique index if not exists agent_activation_wizard_progress_agent_owner_idx
  on public.agent_activation_wizard_progress (agent_id, owner_user_id);

create index if not exists agent_activation_wizard_progress_owner_user_id_idx
  on public.agent_activation_wizard_progress (owner_user_id);

create index if not exists agent_activation_wizard_progress_updated_at_idx
  on public.agent_activation_wizard_progress (updated_at desc);

alter table public.agent_activation_wizard_progress
  enable row level security;

drop policy if exists "Owners can manage activation wizard progress." on public.agent_activation_wizard_progress;
create policy "Owners can manage activation wizard progress."
  on public.agent_activation_wizard_progress
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
