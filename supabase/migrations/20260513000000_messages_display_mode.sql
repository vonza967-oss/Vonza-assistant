alter table public.messages
  add column if not exists display_mode text not null default 'widget';

alter table public.messages
  drop constraint if exists messages_display_mode_check;

alter table public.messages
  add constraint messages_display_mode_check
  check (display_mode in ('widget', 'page'));

create index if not exists messages_agent_display_mode_created_at_idx
  on public.messages (agent_id, display_mode, created_at desc);
