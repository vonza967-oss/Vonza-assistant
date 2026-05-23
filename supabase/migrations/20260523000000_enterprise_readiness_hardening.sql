create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  admin_email text,
  action text not null,
  target_type text,
  target_id text,
  owner_user_id uuid,
  agent_id uuid references public.agents (id) on delete set null,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists admin_audit_logs_admin_user_id_idx
  on public.admin_audit_logs (admin_user_id, created_at desc);

create index if not exists admin_audit_logs_agent_id_idx
  on public.admin_audit_logs (agent_id, created_at desc)
  where agent_id is not null;

create table if not exists public.website_import_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  website_url text not null,
  status text not null default 'queued',
  attempts integer not null default 1,
  page_count integer,
  content_length integer,
  error_code text,
  error_message text,
  metadata jsonb,
  result jsonb,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint website_import_jobs_status_check
    check (status in ('queued', 'running', 'success', 'limited', 'failed'))
);

create index if not exists website_import_jobs_business_id_idx
  on public.website_import_jobs (business_id, created_at desc);

create index if not exists website_import_jobs_owner_user_id_idx
  on public.website_import_jobs (owner_user_id, created_at desc);

create index if not exists website_import_jobs_agent_id_idx
  on public.website_import_jobs (agent_id, created_at desc)
  where agent_id is not null;

alter table public.admin_audit_logs enable row level security;
alter table public.website_import_jobs enable row level security;

drop policy if exists "Owners can read product events for their agents." on public.product_events;
create policy "Owners can read product events for their agents."
  on public.product_events
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      owner_user_id = (select auth.uid())
      or exists (
        select 1
        from public.agents
        where agents.id = product_events.agent_id
          and agents.owner_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Owners can read import jobs for their agents." on public.website_import_jobs;
create policy "Owners can read import jobs for their agents."
  on public.website_import_jobs
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      owner_user_id = (select auth.uid())
      or exists (
        select 1
        from public.agents
        where agents.id = website_import_jobs.agent_id
          and agents.owner_user_id = (select auth.uid())
      )
    )
  );
