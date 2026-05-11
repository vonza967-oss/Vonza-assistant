alter table public.product_events
  add column if not exists owner_user_id uuid,
  add column if not exists dedupe_key text;

create index if not exists product_events_owner_user_id_idx
  on public.product_events (owner_user_id);

create unique index if not exists product_events_dedupe_key_idx
  on public.product_events (dedupe_key)
  where dedupe_key is not null;
