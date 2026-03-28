drop table if exists public.website_content;
drop table if exists public.businesses;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text,
  website_url text unique,
  created_at timestamp with time zone default now()
);

create table public.website_content (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  website_url text,
  page_title text,
  meta_description text,
  content text,
  crawled_urls text[],
  page_count integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index website_content_business_id_idx
  on public.website_content (business_id);
