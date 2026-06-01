alter table public.agents
  add column if not exists package_key text not null default 'front_desk_general';

alter table public.agents
  add column if not exists package_version text not null default '0.1.0';

alter table public.agents
  drop constraint if exists agents_package_key_check;

alter table public.agents
  add constraint agents_package_key_check
  check (package_key in ('front_desk_general'));

create index if not exists agents_package_key_idx
  on public.agents (package_key);
