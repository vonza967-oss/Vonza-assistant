alter table if exists public.widget_configs
  add column if not exists full_page_config jsonb not null default '{}'::jsonb;
