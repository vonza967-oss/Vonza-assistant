alter table public.agents
  drop constraint if exists agents_package_key_check;

alter table public.agents
  add constraint agents_package_key_check
  check (package_key in ('front_desk_general', 'hotel_concierge'));
