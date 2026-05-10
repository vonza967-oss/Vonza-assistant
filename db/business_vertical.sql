alter table public.businesses
  add column if not exists vertical text;

alter table public.businesses
  drop constraint if exists businesses_vertical_check;

alter table public.businesses
  add constraint businesses_vertical_check
  check (vertical is null or vertical in ('clinic', 'web_studio', 'home_services'));

create index if not exists businesses_vertical_idx
  on public.businesses (vertical)
  where vertical is not null;
