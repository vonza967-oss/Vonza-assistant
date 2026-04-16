-- Legacy source: db/widget_logo_url.sql

alter table public.widget_configs
  add column if not exists widget_logo_url text;
