create table if not exists public.widget_early_access_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  focus_area text not null,
  website_url text not null,
  contact_email text,
  contact_phone text,
  contact_raw text not null,
  application_fingerprint text not null,
  status text not null default 'new',
  locale text not null default 'hu-HU',
  source text not null default 'widget_early_access_waitlist',
  source_host text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint widget_early_access_contact_check
    check (contact_email is not null or contact_phone is not null),
  constraint widget_early_access_status_check
    check (status in ('new', 'reviewed', 'invited', 'declined', 'archived'))
);

create unique index if not exists widget_early_access_applications_fingerprint_idx
  on public.widget_early_access_applications (application_fingerprint);

create index if not exists widget_early_access_applications_status_created_idx
  on public.widget_early_access_applications (status, created_at desc);

create index if not exists widget_early_access_applications_created_idx
  on public.widget_early_access_applications (created_at desc);

alter table public.widget_early_access_applications enable row level security;

drop policy if exists "Service role manages widget early access applications." on public.widget_early_access_applications;
create policy "Service role manages widget early access applications."
  on public.widget_early_access_applications
  for all
  to service_role
  using (true)
  with check (true);
