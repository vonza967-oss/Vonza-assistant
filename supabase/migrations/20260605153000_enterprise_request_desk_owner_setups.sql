create table if not exists public.enterprise_request_desk_owner_setups (
  owner_user_id uuid primary key,
  organization_name text not null,
  website_url text not null,
  service_area text not null,
  service_lines text[] not null default '{}'::text[],
  intake_positioning text not null default 'qualified_enterprise_intake',
  routing_preference text not null default 'internal_handoff',
  owner_contact_email text not null,
  setup_status text not null default 'ready_for_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint enterprise_request_desk_owner_setups_routing_preference_check
    check (routing_preference in ('internal_handoff', 'email_triage', 'phone_followup')),
  constraint enterprise_request_desk_owner_setups_setup_status_check
    check (setup_status in ('ready_for_review')),
  constraint enterprise_request_desk_owner_setups_organization_name_nonblank_check
    check (length(btrim(organization_name)) > 0),
  constraint enterprise_request_desk_owner_setups_website_url_nonblank_check
    check (length(btrim(website_url)) > 0),
  constraint enterprise_request_desk_owner_setups_service_area_nonblank_check
    check (length(btrim(service_area)) > 0),
  constraint enterprise_request_desk_owner_setups_service_lines_nonempty_check
    check (array_length(service_lines, 1) > 0),
  constraint enterprise_request_desk_owner_setups_owner_contact_email_nonblank_check
    check (length(btrim(owner_contact_email)) > 0)
);

create index if not exists enterprise_request_desk_owner_setups_updated_at_idx
  on public.enterprise_request_desk_owner_setups (updated_at desc);

alter table public.enterprise_request_desk_owner_setups enable row level security;

revoke all on table public.enterprise_request_desk_owner_setups from anon;
grant select, insert, update, delete on table public.enterprise_request_desk_owner_setups to authenticated;

drop policy if exists "Owners can manage Enterprise Request Desk setup." on public.enterprise_request_desk_owner_setups;
create policy "Owners can manage Enterprise Request Desk setup."
  on public.enterprise_request_desk_owner_setups
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
