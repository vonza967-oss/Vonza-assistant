create table if not exists public.owner_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  plan_key text not null default 'growth',
  billing_interval text not null default 'month',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_product_id text,
  last_checkout_session_id text,
  subscription_status text not null default 'pending',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists owner_billing_accounts_owner_user_id_idx
  on public.owner_billing_accounts (owner_user_id);

create unique index if not exists owner_billing_accounts_subscription_id_idx
  on public.owner_billing_accounts (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists owner_billing_accounts_customer_id_idx
  on public.owner_billing_accounts (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.owner_ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid references public.agents (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,
  billing_period_start timestamp with time zone not null,
  billing_period_end timestamp with time zone not null,
  usage_source text not null default 'chat_reply',
  model text not null,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_cents numeric(12,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create index if not exists owner_ai_usage_ledger_owner_period_idx
  on public.owner_ai_usage_ledger (owner_user_id, billing_period_start, billing_period_end);

create index if not exists owner_ai_usage_ledger_owner_occurred_at_idx
  on public.owner_ai_usage_ledger (owner_user_id, occurred_at desc);

create index if not exists owner_ai_usage_ledger_agent_occurred_at_idx
  on public.owner_ai_usage_ledger (agent_id, occurred_at desc);
