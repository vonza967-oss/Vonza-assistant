create table if not exists public.website_content_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  import_job_id uuid references public.website_import_jobs (id) on delete set null,
  website_url text,
  page_url text not null,
  page_title text,
  meta_description text,
  content text not null default '',
  structured_facts jsonb not null default '{}'::jsonb,
  content_hash text not null,
  status text not null default 'imported',
  error_code text,
  js_fallback_used boolean not null default false,
  page_index integer not null default 0,
  content_length integer not null default 0,
  imported_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint website_content_pages_status_check
    check (status in ('imported', 'failed', 'skipped'))
);

create unique index if not exists website_content_pages_business_page_url_idx
  on public.website_content_pages (business_id, page_url);

create index if not exists website_content_pages_business_page_index_idx
  on public.website_content_pages (business_id, page_index);

create index if not exists website_content_pages_import_job_id_idx
  on public.website_content_pages (import_job_id)
  where import_job_id is not null;

create index if not exists website_content_pages_status_idx
  on public.website_content_pages (status);

alter table public.website_content_pages enable row level security;

drop policy if exists "Owners can read website content pages for their agents." on public.website_content_pages;
create policy "Owners can read website content pages for their agents."
  on public.website_content_pages
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.business_id = website_content_pages.business_id
        and agents.owner_user_id = (select auth.uid())
    )
  );
