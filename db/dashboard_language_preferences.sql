create table if not exists public.user_dashboard_preferences (
  owner_user_id uuid primary key,
  dashboard_language text not null default 'en',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint user_dashboard_preferences_dashboard_language_check
    check (dashboard_language in ('en', 'hu'))
);

alter table public.user_dashboard_preferences
  enable row level security;
