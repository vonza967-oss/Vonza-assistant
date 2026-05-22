alter table if exists public.widget_configs
  add column if not exists voice_config jsonb not null default '{}'::jsonb;
