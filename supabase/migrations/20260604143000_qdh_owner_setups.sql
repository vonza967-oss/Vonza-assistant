create table if not exists public.qdh_owner_setups (
  owner_user_id uuid primary key,
  business_name text not null,
  website_url text not null,
  service_type text not null,
  service_area text not null,
  handling_preference text not null default 'staff_review',
  owner_contact_email text not null,
  services_offered text[] not null default '{}'::text[],
  setup_status text not null default 'ready_for_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint qdh_owner_setups_handling_preference_check
    check (handling_preference in ('staff_review', 'email_review', 'phone_review')),
  constraint qdh_owner_setups_setup_status_check
    check (setup_status in ('ready_for_review')),
  constraint qdh_owner_setups_business_name_nonblank_check
    check (length(btrim(business_name)) > 0),
  constraint qdh_owner_setups_website_url_nonblank_check
    check (length(btrim(website_url)) > 0),
  constraint qdh_owner_setups_services_offered_nonempty_check
    check (array_length(services_offered, 1) > 0)
);

create index if not exists qdh_owner_setups_updated_at_idx
  on public.qdh_owner_setups (updated_at desc);

alter table public.qdh_owner_setups enable row level security;

drop policy if exists "Owners can manage QDH setup." on public.qdh_owner_setups;
create policy "Owners can manage QDH setup."
  on public.qdh_owner_setups
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
