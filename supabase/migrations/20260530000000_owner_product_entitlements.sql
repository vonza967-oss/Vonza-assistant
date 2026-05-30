create table if not exists public.owner_product_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  product_key text not null,
  entitlement_status text not null default 'inactive',
  source text not null,
  plan_key text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_item_id text,
  stripe_price_id text,
  stripe_product_id text,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  trial_start timestamp with time zone,
  trial_end timestamp with time zone,
  cancel_at timestamp with time zone,
  canceled_at timestamp with time zone,
  expires_at timestamp with time zone,
  feature_caps jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint owner_product_entitlements_owner_product_key
    unique (owner_user_id, product_key),
  constraint owner_product_entitlements_product_key_check
    check (product_key in ('front_desk', 'website_widget', 'voice_agent')),
  constraint owner_product_entitlements_status_check
    check (entitlement_status in ('active', 'trialing', 'past_due', 'canceled', 'inactive', 'grandfathered', 'beta', 'free')),
  constraint owner_product_entitlements_source_check
    check (source in ('stripe_subscription_item', 'legacy_workspace_plan', 'manual_beta', 'manual_free', 'internal_trial'))
);

create index if not exists owner_product_entitlements_owner_status_idx
  on public.owner_product_entitlements (owner_user_id, entitlement_status);

create index if not exists owner_product_entitlements_product_status_idx
  on public.owner_product_entitlements (product_key, entitlement_status);

create index if not exists owner_product_entitlements_owner_period_idx
  on public.owner_product_entitlements (owner_user_id, current_period_end desc)
  where current_period_end is not null;

create unique index if not exists owner_product_entitlements_subscription_item_idx
  on public.owner_product_entitlements (stripe_subscription_item_id)
  where stripe_subscription_item_id is not null;

create index if not exists owner_product_entitlements_subscription_idx
  on public.owner_product_entitlements (stripe_subscription_id)
  where stripe_subscription_id is not null;

with eligible_billing_owners as (
  select distinct on (owner_user_id)
    owner_user_id,
    plan_key,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    stripe_product_id,
    subscription_status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    canceled_at,
    null::text as agent_access_status,
    'billing_subscription_status'::text as backfill_reason
  from public.owner_billing_accounts
  where owner_user_id is not null
    and subscription_status in ('active', 'trialing', 'legacy_active', 'legacy-active')
  order by owner_user_id, updated_at desc nulls last, created_at desc nulls last
),
eligible_agent_owners as (
  select distinct on (agents.owner_user_id)
    agents.owner_user_id,
    billing.plan_key,
    billing.stripe_customer_id,
    billing.stripe_subscription_id,
    billing.stripe_price_id,
    billing.stripe_product_id,
    billing.subscription_status,
    billing.current_period_start,
    billing.current_period_end,
    billing.cancel_at_period_end,
    billing.canceled_at,
    agents.access_status as agent_access_status,
    'agent_access_status'::text as backfill_reason
  from public.agents
  left join public.owner_billing_accounts billing
    on billing.owner_user_id = agents.owner_user_id
  where agents.owner_user_id is not null
    and agents.access_status = 'active'
    and not exists (
      select 1
      from eligible_billing_owners billing_owner
      where billing_owner.owner_user_id = agents.owner_user_id
    )
  order by agents.owner_user_id, agents.updated_at desc nulls last, agents.created_at desc nulls last, billing.updated_at desc nulls last
),
eligible_owners as (
  select * from eligible_billing_owners
  union all
  select * from eligible_agent_owners
),
product_keys(product_key) as (
  values
    ('front_desk'),
    ('website_widget'),
    ('voice_agent')
)
insert into public.owner_product_entitlements (
  owner_user_id,
  product_key,
  entitlement_status,
  source,
  plan_key,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  stripe_product_id,
  current_period_start,
  current_period_end,
  canceled_at,
  feature_caps,
  metadata
)
select
  eligible_owners.owner_user_id,
  product_keys.product_key,
  'grandfathered',
  'legacy_workspace_plan',
  eligible_owners.plan_key,
  eligible_owners.stripe_customer_id,
  eligible_owners.stripe_subscription_id,
  eligible_owners.stripe_price_id,
  eligible_owners.stripe_product_id,
  eligible_owners.current_period_start,
  eligible_owners.current_period_end,
  eligible_owners.canceled_at,
  '{}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object(
    'phase', '6a_read_only_entitlement_backfill',
    'backfill_reason', eligible_owners.backfill_reason,
    'subscription_status', eligible_owners.subscription_status,
    'agent_access_status', eligible_owners.agent_access_status,
    'cancel_at_period_end', eligible_owners.cancel_at_period_end
  ))
from eligible_owners
cross join product_keys
on conflict (owner_user_id, product_key) do nothing;

alter table public.owner_product_entitlements enable row level security;

drop policy if exists "Owners can read product entitlements." on public.owner_product_entitlements;
create policy "Owners can read product entitlements."
  on public.owner_product_entitlements
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
