-- Vonza production full recovery / current-main parity bundle.
-- Audited against origin/main on 2026-04-04.
-- Source: exact supabase/migrations SQL, concatenated in the audited order.
--
-- Use this bundle when:
-- - production drift is unknown
-- - you need to bootstrap or reconcile migration history on an existing project
-- - you want full current-main schema parity, not only a startup fix
--
-- Ordering dependencies preserved here:
-- - 20260404000100_owner_access before 20260404000500_action_queue_statuses
-- - 20260404000400_live_conversion_loop and 20260404000600_agent_follow_up_workflows before 20260404001000_connected_operator_workspace
-- - 20260404001000_connected_operator_workspace and 20260404000800_conversion_outcomes before 20260404001100_contacts_people_workspace
-- - 20260404000800_conversion_outcomes before 20260404001200_cross_channel_outcomes
--
-- Safety notes:
-- - This file intentionally preserves the audited migration bodies and order.
-- - It is not wrapped in a transaction so Supabase surfaces the first failing statement.
-- - Unique indexes can still fail if legacy duplicate data already exists.
-- - The first section is the foundational bootstrap baseline for pre-CLI projects.

-- Source: supabase/migrations/20260404000000_initial_schema_base.sql
-- Bootstrap baseline for Vonza projects that existed before Supabase CLI migrations.
-- Legacy source: db/schema.sql (foundational tables only)

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text,
  website_url text unique,
  created_at timestamp with time zone default now()
);

create table if not exists public.website_content (
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

create unique index if not exists website_content_business_id_idx
  on public.website_content (business_id);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  client_id text,
  public_agent_key text unique,
  name text,
  purpose text,
  system_prompt text,
  tone text,
  language text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists agents_business_id_idx
  on public.agents (business_id);

create index if not exists agents_client_id_idx
  on public.agents (client_id);

create table if not exists public.widget_configs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  assistant_name text,
  welcome_message text,
  button_label text,
  primary_color text,
  secondary_color text,
  launcher_text text,
  theme_mode text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists widget_configs_agent_id_idx
  on public.widget_configs (agent_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamp with time zone default now()
);

create index if not exists messages_agent_id_idx
  on public.messages (agent_id);

create index if not exists messages_agent_id_created_at_idx
  on public.messages (agent_id, created_at desc);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  agent_id uuid references public.agents (id) on delete set null,
  event_name text not null,
  source text,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists product_events_client_id_idx
  on public.product_events (client_id);

create index if not exists product_events_event_name_idx
  on public.product_events (event_name);

create index if not exists product_events_created_at_idx
  on public.product_events (created_at desc);

create table if not exists public.agent_installations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  host text not null,
  page_url text,
  first_seen_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now()
);

create unique index if not exists agent_installations_agent_host_idx
  on public.agent_installations (agent_id, host);

create index if not exists agent_installations_agent_id_idx
  on public.agent_installations (agent_id);

create index if not exists agent_installations_last_seen_at_idx
  on public.agent_installations (last_seen_at desc);

-- Source: supabase/migrations/20260404000100_owner_access.sql
-- Legacy source: db/owner_access.sql

alter table public.agents
  add column if not exists owner_user_id uuid;

alter table public.agents
  add column if not exists access_status text default 'pending';

update public.agents
set access_status = 'pending'
where access_status is null;

create index if not exists agents_owner_user_id_idx
  on public.agents (owner_user_id);

-- Source: supabase/migrations/20260404000200_messages_visitor_identity.sql
-- Legacy source: db/messages_visitor_identity.sql

alter table public.messages
  add column if not exists session_key text,
  add column if not exists visitor_identity_mode text,
  add column if not exists visitor_email text,
  add column if not exists visitor_name text;

create index if not exists messages_agent_id_session_key_created_at_idx
  on public.messages (agent_id, session_key, created_at desc);

create index if not exists messages_agent_id_visitor_email_created_at_idx
  on public.messages (agent_id, visitor_email, created_at desc)
  where visitor_email is not null;

-- Source: supabase/migrations/20260404000201_message_visitor_identity_fields.sql
-- Follow-up for existing production databases where
-- 20260404000200_messages_visitor_identity.sql already ran before these
-- durable visitor identity fields were added. Keep this paired with
-- db/schema.sql so deploy schema gates see the canonical snapshot change.

alter table public.messages
  add column if not exists visitor_identity_mode text,
  add column if not exists visitor_email text,
  add column if not exists visitor_name text;

create index if not exists messages_agent_id_visitor_email_created_at_idx
  on public.messages (agent_id, visitor_email, created_at desc)
  where visitor_email is not null;

-- Source: supabase/migrations/20260404000300_install_verification_activation_loop.sql
-- Legacy source: db/install_verification_activation_loop.sql

alter table if exists public.widget_configs
  add column if not exists install_id uuid default gen_random_uuid(),
  add column if not exists allowed_domains text[] not null default '{}',
  add column if not exists last_verification_status text,
  add column if not exists last_verified_at timestamp with time zone,
  add column if not exists last_verification_origin text,
  add column if not exists last_verification_target_url text,
  add column if not exists last_verification_details jsonb;

update public.widget_configs
set install_id = gen_random_uuid()
where install_id is null;

update public.widget_configs wc
set allowed_domains = array[
  lower(
    regexp_replace(
      split_part(split_part(coalesce(b.website_url, ''), '://', 2), '/', 1),
      '^www\\.',
      ''
    )
  )
]
from public.agents a
join public.businesses b
  on b.id = a.business_id
where wc.agent_id = a.id
  and (wc.allowed_domains is null or cardinality(wc.allowed_domains) = 0)
  and coalesce(b.website_url, '') <> '';

create unique index if not exists widget_configs_install_id_idx
  on public.widget_configs (install_id);

alter table if exists public.agent_installations
  add column if not exists origin text,
  add column if not exists last_session_id text,
  add column if not exists last_fingerprint text;

create table if not exists public.agent_widget_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  install_id uuid,
  session_id text not null,
  fingerprint text,
  event_name text not null,
  origin text,
  page_url text,
  metadata jsonb,
  dedupe_key text not null,
  created_at timestamp with time zone default now()
);

create unique index if not exists agent_widget_events_dedupe_key_idx
  on public.agent_widget_events (dedupe_key);

create index if not exists agent_widget_events_agent_id_idx
  on public.agent_widget_events (agent_id);

create index if not exists agent_widget_events_event_name_idx
  on public.agent_widget_events (event_name);

create index if not exists agent_widget_events_created_at_idx
  on public.agent_widget_events (created_at desc);

-- Source: supabase/migrations/20260404000400_live_conversion_loop.sql
-- Legacy source: db/live_conversion_loop.sql

create table if not exists public.agent_contact_leads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  install_id uuid,
  lead_key text not null,
  person_key text,
  visitor_session_key text,
  capture_state text not null default 'none',
  preferred_channel text,
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_phone_normalized text,
  source_page_url text,
  source_origin text,
  latest_intent_type text,
  latest_action_type text,
  latest_action_key text,
  latest_message_id text,
  related_action_keys text[] not null default '{}',
  prompt_count integer not null default 0,
  prompted_at timestamp with time zone,
  captured_at timestamp with time zone,
  declined_at timestamp with time zone,
  blocked_at timestamp with time zone,
  first_seen_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  capture_trigger text,
  capture_reason text,
  capture_prompt text,
  capture_source text not null default 'widget_live_chat',
  capture_metadata jsonb not null default '{}'::jsonb,
  related_follow_up_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists agent_contact_leads_agent_owner_lead_key_idx
  on public.agent_contact_leads (agent_id, owner_user_id, lead_key);

create unique index if not exists agent_contact_leads_agent_owner_session_idx
  on public.agent_contact_leads (agent_id, owner_user_id, visitor_session_key)
  where visitor_session_key is not null;

create unique index if not exists agent_contact_leads_agent_owner_email_idx
  on public.agent_contact_leads (agent_id, owner_user_id, contact_email)
  where contact_email is not null;

create unique index if not exists agent_contact_leads_agent_owner_phone_idx
  on public.agent_contact_leads (agent_id, owner_user_id, contact_phone_normalized)
  where contact_phone_normalized is not null;

create index if not exists agent_contact_leads_agent_owner_updated_idx
  on public.agent_contact_leads (agent_id, owner_user_id, updated_at desc);

create index if not exists agent_contact_leads_agent_person_idx
  on public.agent_contact_leads (agent_id, person_key);

-- Source: supabase/migrations/20260404000500_action_queue_statuses.sql
-- Legacy source: db/action_queue_statuses.sql

create table if not exists public.agent_action_queue_statuses (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  action_key text not null,
  status text default 'new',
  note text,
  outcome text,
  next_step text,
  follow_up_needed boolean,
  follow_up_completed boolean,
  contact_status text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.agent_action_queue_statuses
  add column if not exists note text;

alter table public.agent_action_queue_statuses
  add column if not exists outcome text;

alter table public.agent_action_queue_statuses
  add column if not exists next_step text;

alter table public.agent_action_queue_statuses
  add column if not exists follow_up_needed boolean;

alter table public.agent_action_queue_statuses
  add column if not exists follow_up_completed boolean;

alter table public.agent_action_queue_statuses
  add column if not exists contact_status text;

create unique index if not exists agent_action_queue_statuses_agent_action_key_idx
  on public.agent_action_queue_statuses (agent_id, action_key);

create index if not exists agent_action_queue_statuses_owner_user_id_idx
  on public.agent_action_queue_statuses (owner_user_id);

create index if not exists agent_action_queue_statuses_status_idx
  on public.agent_action_queue_statuses (status);

-- Source: supabase/migrations/20260404000600_agent_follow_up_workflows.sql
-- Legacy source: db/agent_follow_up_workflows.sql

create table if not exists public.agent_follow_up_workflows (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  dedupe_key text not null,
  source_action_key text not null,
  linked_action_keys text[] not null default '{}',
  action_type text not null,
  person_key text,
  status text not null default 'draft',
  channel text,
  contact_name text,
  contact_email text,
  contact_phone text,
  subject text,
  draft_content text,
  last_generated_subject text,
  last_generated_content text,
  draft_edited_manually boolean not null default false,
  evidence text,
  why_prepared text,
  topic text,
  page_hint text,
  source_hash text,
  last_error text,
  sent_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.agent_follow_up_workflows
  add column if not exists linked_action_keys text[] not null default '{}';

alter table public.agent_follow_up_workflows
  add column if not exists action_type text;

alter table public.agent_follow_up_workflows
  add column if not exists person_key text;

alter table public.agent_follow_up_workflows
  add column if not exists status text default 'draft';

alter table public.agent_follow_up_workflows
  add column if not exists channel text;

alter table public.agent_follow_up_workflows
  add column if not exists contact_name text;

alter table public.agent_follow_up_workflows
  add column if not exists contact_email text;

alter table public.agent_follow_up_workflows
  add column if not exists contact_phone text;

alter table public.agent_follow_up_workflows
  add column if not exists subject text;

alter table public.agent_follow_up_workflows
  add column if not exists draft_content text;

alter table public.agent_follow_up_workflows
  add column if not exists last_generated_subject text;

alter table public.agent_follow_up_workflows
  add column if not exists last_generated_content text;

alter table public.agent_follow_up_workflows
  add column if not exists draft_edited_manually boolean not null default false;

alter table public.agent_follow_up_workflows
  add column if not exists evidence text;

alter table public.agent_follow_up_workflows
  add column if not exists why_prepared text;

alter table public.agent_follow_up_workflows
  add column if not exists topic text;

alter table public.agent_follow_up_workflows
  add column if not exists page_hint text;

alter table public.agent_follow_up_workflows
  add column if not exists source_hash text;

alter table public.agent_follow_up_workflows
  add column if not exists last_error text;

alter table public.agent_follow_up_workflows
  add column if not exists sent_at timestamp with time zone;

alter table public.agent_follow_up_workflows
  add column if not exists dismissed_at timestamp with time zone;

create unique index if not exists agent_follow_up_workflows_agent_dedupe_idx
  on public.agent_follow_up_workflows (agent_id, owner_user_id, dedupe_key);

create index if not exists agent_follow_up_workflows_agent_owner_idx
  on public.agent_follow_up_workflows (agent_id, owner_user_id);

create index if not exists agent_follow_up_workflows_status_idx
  on public.agent_follow_up_workflows (status);

-- Source: supabase/migrations/20260404000700_agent_knowledge_fix_workflows.sql
-- Legacy source: db/agent_knowledge_fix_workflows.sql

create table if not exists public.agent_knowledge_fix_workflows (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  dedupe_key text not null,
  source_action_key text not null,
  linked_action_keys text[] not null default '{}',
  action_type text not null,
  status text not null default 'draft',
  target_type text not null default 'system_prompt',
  target_label text,
  topic text,
  issue_key text,
  issue_summary text,
  matters_summary text,
  proposed_guidance text,
  last_generated_guidance text,
  draft_edited_manually boolean not null default false,
  evidence jsonb,
  occurrence_count integer not null default 1,
  source_hash text,
  applied_guidance text,
  applied_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.agent_knowledge_fix_workflows
  add column if not exists linked_action_keys text[] not null default '{}';

alter table public.agent_knowledge_fix_workflows
  add column if not exists action_type text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists status text default 'draft';

alter table public.agent_knowledge_fix_workflows
  add column if not exists target_type text default 'system_prompt';

alter table public.agent_knowledge_fix_workflows
  add column if not exists target_label text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists topic text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists issue_key text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists issue_summary text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists matters_summary text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists proposed_guidance text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists last_generated_guidance text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists draft_edited_manually boolean not null default false;

alter table public.agent_knowledge_fix_workflows
  add column if not exists evidence jsonb;

alter table public.agent_knowledge_fix_workflows
  add column if not exists occurrence_count integer not null default 1;

alter table public.agent_knowledge_fix_workflows
  add column if not exists source_hash text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists applied_guidance text;

alter table public.agent_knowledge_fix_workflows
  add column if not exists applied_at timestamp with time zone;

alter table public.agent_knowledge_fix_workflows
  add column if not exists dismissed_at timestamp with time zone;

alter table public.agent_knowledge_fix_workflows
  add column if not exists last_error text;

create unique index if not exists agent_knowledge_fix_workflows_agent_dedupe_idx
  on public.agent_knowledge_fix_workflows (agent_id, owner_user_id, dedupe_key);

create index if not exists agent_knowledge_fix_workflows_agent_owner_idx
  on public.agent_knowledge_fix_workflows (agent_id, owner_user_id);

create index if not exists agent_knowledge_fix_workflows_status_idx
  on public.agent_knowledge_fix_workflows (status);

-- Source: supabase/migrations/20260404000800_conversion_outcomes.sql
-- Legacy source: db/conversion_outcomes.sql

alter table public.widget_configs
  add column if not exists booking_start_url text;

alter table public.widget_configs
  add column if not exists quote_start_url text;

alter table public.widget_configs
  add column if not exists booking_success_url text;

alter table public.widget_configs
  add column if not exists quote_success_url text;

alter table public.widget_configs
  add column if not exists checkout_success_url text;

alter table public.widget_configs
  add column if not exists success_url_match_mode text;

alter table public.widget_configs
  add column if not exists manual_outcome_mode boolean not null default false;

create table if not exists public.agent_conversion_outcomes (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  install_id uuid,
  outcome_type text not null,
  source_type text not null,
  confirmation_level text not null default 'observed',
  dedupe_key text not null,
  cta_event_id uuid,
  related_cta_type text,
  related_target_type text,
  related_action_type text,
  related_intent_type text,
  visitor_id text,
  session_id text,
  fingerprint text,
  conversation_id text,
  person_key text,
  lead_id uuid,
  contact_id uuid,
  action_key text,
  follow_up_id uuid,
  inbox_thread_id uuid,
  calendar_event_id uuid,
  campaign_id uuid,
  campaign_recipient_id uuid,
  operator_task_id uuid,
  page_url text,
  origin text,
  target_url text,
  success_url text,
  attribution_path text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists agent_conversion_outcomes_dedupe_key_idx
  on public.agent_conversion_outcomes (dedupe_key);

create index if not exists agent_conversion_outcomes_agent_owner_idx
  on public.agent_conversion_outcomes (agent_id, owner_user_id);

create index if not exists agent_conversion_outcomes_cta_event_idx
  on public.agent_conversion_outcomes (cta_event_id);

create index if not exists agent_conversion_outcomes_lead_idx
  on public.agent_conversion_outcomes (lead_id);

create index if not exists agent_conversion_outcomes_type_idx
  on public.agent_conversion_outcomes (outcome_type);

create index if not exists agent_conversion_outcomes_occurred_at_idx
  on public.agent_conversion_outcomes (occurred_at desc);

create index if not exists agent_conversion_outcomes_contact_idx
  on public.agent_conversion_outcomes (contact_id);

create index if not exists agent_conversion_outcomes_inbox_thread_idx
  on public.agent_conversion_outcomes (inbox_thread_id);

create index if not exists agent_conversion_outcomes_calendar_event_idx
  on public.agent_conversion_outcomes (calendar_event_id);

create index if not exists agent_conversion_outcomes_campaign_idx
  on public.agent_conversion_outcomes (campaign_id);

create index if not exists agent_conversion_outcomes_campaign_recipient_idx
  on public.agent_conversion_outcomes (campaign_recipient_id);

create index if not exists agent_conversion_outcomes_operator_task_idx
  on public.agent_conversion_outcomes (operator_task_id);

create index if not exists agent_conversion_outcomes_attribution_path_idx
  on public.agent_conversion_outcomes (attribution_path);

-- Source: supabase/migrations/20260404000900_direct_conversion_routing.sql
-- Legacy source: db/direct_conversion_routing.sql

alter table if exists public.widget_configs
  add column if not exists booking_url text;

alter table if exists public.widget_configs
  add column if not exists quote_url text;

alter table if exists public.widget_configs
  add column if not exists checkout_url text;

alter table if exists public.widget_configs
  add column if not exists contact_email text;

alter table if exists public.widget_configs
  add column if not exists contact_phone text;

alter table if exists public.widget_configs
  add column if not exists primary_cta_mode text;

alter table if exists public.widget_configs
  add column if not exists fallback_cta_mode text;

alter table if exists public.widget_configs
  add column if not exists business_hours_note text;

-- Source: supabase/migrations/20260404001000_connected_operator_workspace.sql
-- Legacy source: db/connected_operator_workspace.sql

create table if not exists public.google_oauth_states (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  provider text not null default 'google',
  requested_scopes text[] not null default '{}',
  redirect_path text,
  selected_mailbox text,
  state_token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists google_oauth_states_agent_owner_idx
  on public.google_oauth_states (agent_id, owner_user_id);

create index if not exists google_oauth_states_status_idx
  on public.google_oauth_states (status);

create table if not exists public.google_connected_accounts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  provider text not null default 'google',
  provider_account_id text,
  account_email text,
  display_name text,
  selected_mailbox text default 'INBOX',
  scopes text[] not null default '{}',
  scope_audit jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamp with time zone,
  last_refreshed_at timestamp with time zone,
  last_sync_at timestamp with time zone,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists google_connected_accounts_provider_account_idx
  on public.google_connected_accounts (agent_id, owner_user_id, provider, provider_account_id);

create unique index if not exists google_connected_accounts_email_idx
  on public.google_connected_accounts (agent_id, owner_user_id, provider, account_email)
  where account_email is not null;

create index if not exists google_connected_accounts_agent_owner_idx
  on public.google_connected_accounts (agent_id, owner_user_id);

create index if not exists google_connected_accounts_status_idx
  on public.google_connected_accounts (status);

create unique index if not exists google_connected_accounts_agent_provider_idx
  on public.google_connected_accounts (agent_id, owner_user_id, provider);

create table if not exists public.operator_inbox_threads (
  id uuid primary key default gen_random_uuid(),
  connected_account_id uuid references public.google_connected_accounts (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  provider_thread_id text not null,
  provider_history_id text,
  mailbox_label text,
  subject text,
  snippet text,
  classification text not null default 'follow_up_needed',
  priority text not null default 'normal',
  status text not null default 'open',
  complaint_state text not null default 'none',
  follow_up_state text not null default 'open',
  needs_reply boolean not null default false,
  risk_level text not null default 'normal',
  unread_count integer not null default 0,
  participants jsonb not null default '[]'::jsonb,
  related_lead_id uuid references public.agent_contact_leads (id) on delete set null,
  related_follow_up_id uuid references public.agent_follow_up_workflows (id) on delete set null,
  related_action_key text,
  last_message_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_inbox_threads_provider_thread_idx
  on public.operator_inbox_threads (connected_account_id, provider_thread_id);

create index if not exists operator_inbox_threads_agent_owner_idx
  on public.operator_inbox_threads (agent_id, owner_user_id, updated_at desc);

create index if not exists operator_inbox_threads_classification_idx
  on public.operator_inbox_threads (classification, status);

create table if not exists public.operator_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.operator_inbox_threads (id) on delete cascade,
  connected_account_id uuid references public.google_connected_accounts (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  provider_message_id text not null,
  direction text not null default 'inbound',
  approval_status text not null default 'not_required',
  message_state text not null default 'stored',
  sender text,
  recipients text[] not null default '{}',
  cc text[] not null default '{}',
  subject text,
  body_preview text,
  body_text text,
  sent_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_inbox_messages_provider_message_idx
  on public.operator_inbox_messages (connected_account_id, provider_message_id);

create index if not exists operator_inbox_messages_thread_idx
  on public.operator_inbox_messages (thread_id, created_at desc);

create table if not exists public.operator_calendar_events (
  id uuid primary key default gen_random_uuid(),
  connected_account_id uuid references public.google_connected_accounts (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  provider_event_id text,
  action_type text not null default 'view',
  source_kind text not null default 'google_sync',
  status text not null default 'confirmed',
  approval_status text not null default 'synced',
  title text,
  description text,
  attendee_emails text[] not null default '{}',
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  timezone text,
  location text,
  lead_id uuid references public.agent_contact_leads (id) on delete set null,
  related_action_key text,
  conflict_state text not null default 'clear',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_calendar_events_provider_event_idx
  on public.operator_calendar_events (connected_account_id, provider_event_id)
  where provider_event_id is not null;

create index if not exists operator_calendar_events_agent_owner_idx
  on public.operator_calendar_events (agent_id, owner_user_id, start_at asc);

create index if not exists operator_calendar_events_approval_idx
  on public.operator_calendar_events (approval_status, status);

create table if not exists public.operator_campaigns (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  goal text not null,
  title text not null,
  status text not null default 'draft',
  approval_status text not null default 'draft',
  recipient_source text not null default 'captured_leads',
  source_filters jsonb not null default '{}'::jsonb,
  schedule_config jsonb not null default '{}'::jsonb,
  sequence_summary text,
  reply_handling_mode text not null default 'manual_review',
  approved_at timestamp with time zone,
  activated_at timestamp with time zone,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists operator_campaigns_agent_owner_idx
  on public.operator_campaigns (agent_id, owner_user_id, created_at desc);

create index if not exists operator_campaigns_status_idx
  on public.operator_campaigns (status, approval_status);

create table if not exists public.operator_campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.operator_campaigns (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  step_order integer not null,
  channel text not null default 'email',
  timing_offset_hours integer not null default 0,
  subject text,
  body text,
  approval_status text not null default 'pending_owner',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_campaign_steps_campaign_order_idx
  on public.operator_campaign_steps (campaign_id, step_order);

create table if not exists public.operator_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.operator_campaigns (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  lead_id uuid references public.agent_contact_leads (id) on delete set null,
  person_key text,
  contact_name text,
  contact_email text,
  status text not null default 'pending',
  current_step_index integer not null default 0,
  next_send_at timestamp with time zone,
  last_contacted_at timestamp with time zone,
  reply_state text not null default 'awaiting_reply',
  last_thread_id uuid references public.operator_inbox_threads (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_campaign_recipients_campaign_email_idx
  on public.operator_campaign_recipients (campaign_id, contact_email)
  where contact_email is not null;

create index if not exists operator_campaign_recipients_campaign_status_idx
  on public.operator_campaign_recipients (campaign_id, status, next_send_at);

create table if not exists public.operator_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  source_type text not null,
  source_id text not null,
  task_type text not null,
  title text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'normal',
  approval_required boolean not null default false,
  related_thread_id uuid references public.operator_inbox_threads (id) on delete set null,
  related_event_id uuid references public.operator_calendar_events (id) on delete set null,
  related_campaign_id uuid references public.operator_campaigns (id) on delete set null,
  related_lead_id uuid references public.agent_contact_leads (id) on delete set null,
  related_action_key text,
  task_state jsonb not null default '{}'::jsonb,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_tasks_source_dedupe_idx
  on public.operator_tasks (agent_id, owner_user_id, source_type, source_id, task_type);

create index if not exists operator_tasks_status_idx
  on public.operator_tasks (status, priority, created_at desc);

create table if not exists public.operator_workspace_activations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  operator_workspace_enabled boolean not null default true,
  google_connected boolean not null default false,
  inbox_context_selected boolean not null default false,
  calendar_context_selected boolean not null default false,
  inbox_synced boolean not null default false,
  calendar_synced boolean not null default false,
  first_inbox_review_completed boolean not null default false,
  first_reply_draft_created boolean not null default false,
  first_campaign_draft_created boolean not null default false,
  first_calendar_action_reviewed boolean not null default false,
  activation_completed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_workspace_activations_agent_owner_idx
  on public.operator_workspace_activations (agent_id, owner_user_id);

create table if not exists public.operator_audit_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  connected_account_id uuid references public.google_connected_accounts (id) on delete set null,
  actor_type text not null,
  actor_id text,
  action_type text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists operator_audit_logs_agent_owner_idx
  on public.operator_audit_logs (agent_id, owner_user_id, created_at desc);

-- Source: supabase/migrations/20260404001100_contacts_people_workspace.sql
-- Legacy source: db/contacts_people_workspace.sql

create table if not exists public.operator_contacts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  display_name text,
  primary_email text,
  primary_phone text,
  primary_phone_normalized text,
  primary_person_key text,
  lifecycle_state text not null default 'new',
  lifecycle_state_source text not null default 'system',
  suggested_lifecycle_state text not null default 'new',
  activity_sources text[] not null default '{}',
  high_priority_flags text[] not null default '{}',
  last_activity_at timestamp with time zone,
  next_action_type text not null default 'no_action_needed',
  next_action_title text,
  next_action_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists operator_contacts_agent_owner_idx
  on public.operator_contacts (agent_id, owner_user_id, last_activity_at desc);

create index if not exists operator_contacts_lifecycle_idx
  on public.operator_contacts (agent_id, owner_user_id, lifecycle_state, last_activity_at desc);

create index if not exists operator_contacts_primary_email_idx
  on public.operator_contacts (agent_id, owner_user_id, primary_email)
  where primary_email is not null;

create index if not exists operator_contacts_primary_phone_idx
  on public.operator_contacts (agent_id, owner_user_id, primary_phone_normalized)
  where primary_phone_normalized is not null;

create table if not exists public.operator_contact_identities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.operator_contacts (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  identity_type text not null,
  identity_value text not null,
  is_primary boolean not null default false,
  source_type text not null default 'contact_sync',
  first_seen_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_contact_identities_unique_idx
  on public.operator_contact_identities (agent_id, owner_user_id, identity_type, identity_value);

create index if not exists operator_contact_identities_contact_idx
  on public.operator_contact_identities (contact_id, identity_type, last_seen_at desc);

alter table public.agent_contact_leads
  add column if not exists contact_id uuid references public.operator_contacts (id) on delete set null;

create index if not exists agent_contact_leads_contact_idx
  on public.agent_contact_leads (contact_id);

alter table public.agent_follow_up_workflows
  add column if not exists contact_id uuid references public.operator_contacts (id) on delete set null;

create index if not exists agent_follow_up_workflows_contact_idx
  on public.agent_follow_up_workflows (contact_id);

alter table public.agent_conversion_outcomes
  add column if not exists contact_id uuid references public.operator_contacts (id) on delete set null;

create index if not exists agent_conversion_outcomes_contact_idx
  on public.agent_conversion_outcomes (contact_id);

alter table public.operator_inbox_threads
  add column if not exists contact_id uuid references public.operator_contacts (id) on delete set null;

create index if not exists operator_inbox_threads_contact_idx
  on public.operator_inbox_threads (contact_id);

alter table public.operator_calendar_events
  add column if not exists contact_id uuid references public.operator_contacts (id) on delete set null;

create index if not exists operator_calendar_events_contact_idx
  on public.operator_calendar_events (contact_id);

alter table public.operator_campaign_recipients
  add column if not exists contact_id uuid references public.operator_contacts (id) on delete set null;

create index if not exists operator_campaign_recipients_contact_idx
  on public.operator_campaign_recipients (contact_id);

alter table public.operator_tasks
  add column if not exists contact_id uuid references public.operator_contacts (id) on delete set null;

create index if not exists operator_tasks_contact_idx
  on public.operator_tasks (contact_id);

-- Source: supabase/migrations/20260404001200_cross_channel_outcomes.sql
-- Legacy source: db/cross_channel_outcomes.sql

alter table public.agent_conversion_outcomes
  add column if not exists inbox_thread_id uuid,
  add column if not exists calendar_event_id uuid,
  add column if not exists campaign_id uuid,
  add column if not exists campaign_recipient_id uuid,
  add column if not exists operator_task_id uuid,
  add column if not exists attribution_path text;

update public.agent_conversion_outcomes
set attribution_path = nullif(metadata->>'attributionPath', '')
where attribution_path is null
  and metadata ? 'attributionPath';

create index if not exists agent_conversion_outcomes_inbox_thread_idx
  on public.agent_conversion_outcomes (inbox_thread_id);

create index if not exists agent_conversion_outcomes_calendar_event_idx
  on public.agent_conversion_outcomes (calendar_event_id);

create index if not exists agent_conversion_outcomes_campaign_idx
  on public.agent_conversion_outcomes (campaign_id);

create index if not exists agent_conversion_outcomes_campaign_recipient_idx
  on public.agent_conversion_outcomes (campaign_recipient_id);

create index if not exists agent_conversion_outcomes_operator_task_idx
  on public.agent_conversion_outcomes (operator_task_id);

create index if not exists agent_conversion_outcomes_attribution_path_idx
  on public.agent_conversion_outcomes (attribution_path);

-- Source: supabase/migrations/20260404001300_operator_business_profiles.sql
create table if not exists public.operator_business_profiles (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  business_summary text,
  services jsonb not null default '[]'::jsonb,
  pricing jsonb not null default '[]'::jsonb,
  policies jsonb not null default '[]'::jsonb,
  service_areas jsonb not null default '[]'::jsonb,
  operating_hours jsonb not null default '[]'::jsonb,
  approved_contact_channels text[] not null default '{}',
  approval_preferences jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists operator_business_profiles_agent_owner_idx
  on public.operator_business_profiles (agent_id, owner_user_id);

create index if not exists operator_business_profiles_business_idx
  on public.operator_business_profiles (business_id, updated_at desc);

-- Source: supabase/migrations/20260404001400_copilot_proposal_states.sql
create table if not exists public.agent_copilot_proposal_states (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  owner_user_id uuid,
  proposal_key text not null,
  proposal_type text not null,
  status text not null default 'new',
  proposal_hash text not null,
  status_reason text,
  result_type text,
  result_id text,
  result_section text,
  applied_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists agent_copilot_proposal_states_agent_owner_key_idx
  on public.agent_copilot_proposal_states (agent_id, owner_user_id, proposal_key);

create index if not exists agent_copilot_proposal_states_status_idx
  on public.agent_copilot_proposal_states (agent_id, owner_user_id, status, updated_at desc);

-- Source: supabase/migrations/20260416000000_widget_logo_url.sql
-- Legacy source: db/widget_logo_url.sql

alter table public.widget_configs
  add column if not exists widget_logo_url text;

-- Source: supabase/migrations/20260422000000_dashboard_language_preferences.sql
create table if not exists public.user_dashboard_preferences (
  owner_user_id uuid primary key,
  dashboard_language text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint user_dashboard_preferences_dashboard_language_check
    check (dashboard_language in ('en', 'hu'))
);

alter table public.user_dashboard_preferences
  alter column dashboard_language set default 'en';

alter table public.user_dashboard_preferences
  alter column dashboard_language set not null;

alter table public.user_dashboard_preferences
  enable row level security;

-- Source: supabase/migrations/20260428000000_billing_plans_ai_usage.sql
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

-- Source: supabase/migrations/20260510000000_business_vertical.sql
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

-- Source: supabase/migrations/20260510001000_rls_hardening.sql
alter table public.businesses enable row level security;
alter table public.website_content enable row level security;
alter table public.agents enable row level security;
alter table public.widget_configs enable row level security;
alter table public.messages enable row level security;
alter table public.user_dashboard_preferences enable row level security;
alter table public.agent_action_queue_statuses enable row level security;
alter table public.agent_follow_up_workflows enable row level security;
alter table public.agent_contact_leads enable row level security;
alter table public.agent_knowledge_fix_workflows enable row level security;
alter table public.product_events enable row level security;
alter table public.agent_installations enable row level security;
alter table public.agent_widget_events enable row level security;
alter table public.agent_conversion_outcomes enable row level security;
alter table public.google_oauth_states enable row level security;
alter table public.google_connected_accounts enable row level security;
alter table public.operator_contacts enable row level security;
alter table public.operator_contact_identities enable row level security;
alter table public.operator_inbox_threads enable row level security;
alter table public.operator_inbox_messages enable row level security;
alter table public.operator_calendar_events enable row level security;
alter table public.operator_campaigns enable row level security;
alter table public.operator_campaign_steps enable row level security;
alter table public.operator_campaign_recipients enable row level security;
alter table public.operator_tasks enable row level security;
alter table public.operator_workspace_activations enable row level security;
alter table public.operator_business_profiles enable row level security;
alter table public.agent_copilot_proposal_states enable row level security;
alter table public.operator_audit_logs enable row level security;
alter table public.owner_billing_accounts enable row level security;
alter table public.owner_ai_usage_ledger enable row level security;

drop policy if exists "Owners can read their dashboard preferences." on public.user_dashboard_preferences;
create policy "Owners can read their dashboard preferences."
  on public.user_dashboard_preferences
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Owners can insert their dashboard preferences." on public.user_dashboard_preferences;
create policy "Owners can insert their dashboard preferences."
  on public.user_dashboard_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Owners can update their dashboard preferences." on public.user_dashboard_preferences;
create policy "Owners can update their dashboard preferences."
  on public.user_dashboard_preferences
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Owners can manage their agents." on public.agents;
create policy "Owners can manage their agents."
  on public.agents
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read businesses for their agents." on public.businesses;
create policy "Owners can read businesses for their agents."
  on public.businesses
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.business_id = businesses.id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read website content for their agents." on public.website_content;
create policy "Owners can read website content for their agents."
  on public.website_content
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.business_id = website_content.business_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can manage widget configs for their agents." on public.widget_configs;
create policy "Owners can manage widget configs for their agents."
  on public.widget_configs
  for all
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = widget_configs.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = widget_configs.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read messages for their agents." on public.messages;
create policy "Owners can read messages for their agents."
  on public.messages
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = messages.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read widget events for their agents." on public.agent_widget_events;
create policy "Owners can read widget events for their agents."
  on public.agent_widget_events
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_widget_events.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read installations for their agents." on public.agent_installations;
create policy "Owners can read installations for their agents."
  on public.agent_installations
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_installations.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can manage action queue statuses." on public.agent_action_queue_statuses;
create policy "Owners can manage action queue statuses."
  on public.agent_action_queue_statuses
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage follow-up workflows." on public.agent_follow_up_workflows;
create policy "Owners can manage follow-up workflows."
  on public.agent_follow_up_workflows
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage contact leads." on public.agent_contact_leads;
create policy "Owners can manage contact leads."
  on public.agent_contact_leads
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage knowledge fix workflows." on public.agent_knowledge_fix_workflows;
create policy "Owners can manage knowledge fix workflows."
  on public.agent_knowledge_fix_workflows
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage conversion outcomes." on public.agent_conversion_outcomes;
create policy "Owners can manage conversion outcomes."
  on public.agent_conversion_outcomes
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage operator contacts." on public.operator_contacts;
create policy "Owners can manage operator contacts."
  on public.operator_contacts
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage operator contact identities." on public.operator_contact_identities;
create policy "Owners can manage operator contact identities."
  on public.operator_contact_identities
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage operator tasks." on public.operator_tasks;
create policy "Owners can manage operator tasks."
  on public.operator_tasks
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage operator business profiles." on public.operator_business_profiles;
create policy "Owners can manage operator business profiles."
  on public.operator_business_profiles
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage copilot proposal states." on public.agent_copilot_proposal_states;
create policy "Owners can manage copilot proposal states."
  on public.agent_copilot_proposal_states
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read their billing account." on public.owner_billing_accounts;
create policy "Owners can read their billing account."
  on public.owner_billing_accounts
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read their AI usage ledger." on public.owner_ai_usage_ledger;
create policy "Owners can read their AI usage ledger."
  on public.owner_ai_usage_ledger
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260510002000_visitor_reply_feedback.sql
create table if not exists public.agent_visitor_reply_feedback (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  install_id text,
  session_key text not null,
  assistant_message_key text not null,
  rating text not null,
  message_context jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  constraint agent_visitor_reply_feedback_rating_check
    check (rating in ('helpful', 'not_helpful'))
);

create unique index if not exists agent_visitor_reply_feedback_message_idx
  on public.agent_visitor_reply_feedback (agent_id, session_key, assistant_message_key);

create index if not exists agent_visitor_reply_feedback_agent_created_idx
  on public.agent_visitor_reply_feedback (agent_id, created_at desc);

alter table public.agent_visitor_reply_feedback enable row level security;

drop policy if exists "Owners can read reply feedback for their agents." on public.agent_visitor_reply_feedback;
create policy "Owners can read reply feedback for their agents."
  on public.agent_visitor_reply_feedback
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_visitor_reply_feedback.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

-- Source: supabase/migrations/20260510003000_customer_value_trust_controls.sql
-- Legacy source: db/customer_value_trust_controls.sql

create table if not exists public.agent_human_follow_up_statuses (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  item_key text not null,
  action_key text,
  follow_up_id uuid references public.agent_follow_up_workflows (id) on delete set null,
  knowledge_fix_id uuid references public.agent_knowledge_fix_workflows (id) on delete set null,
  status text not null default 'new',
  note text,
  owner_reply text,
  follow_up_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_human_follow_up_statuses_status_check
    check (status in ('new', 'reviewing', 'replied', 'follow_up_later', 'dismissed'))
);

create unique index if not exists agent_human_follow_up_statuses_item_idx
  on public.agent_human_follow_up_statuses (agent_id, owner_user_id, item_key);

create index if not exists agent_human_follow_up_statuses_owner_status_idx
  on public.agent_human_follow_up_statuses (agent_id, owner_user_id, status, updated_at desc);

create table if not exists public.agent_owner_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  dedupe_key text not null,
  type text not null,
  title text not null,
  reason text,
  related_action_key text,
  related_follow_up_id uuid references public.agent_follow_up_workflows (id) on delete set null,
  related_knowledge_fix_id uuid references public.agent_knowledge_fix_workflows (id) on delete set null,
  recommended_next_action text,
  status text not null default 'unread',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_owner_notifications_type_check
    check (type in ('high_intent_lead', 'unhappy_customer', 'not_helpful_ai_reply', 'repeated_unanswered_question')),
  constraint agent_owner_notifications_status_check
    check (status in ('unread', 'read', 'dismissed'))
);

create unique index if not exists agent_owner_notifications_dedupe_idx
  on public.agent_owner_notifications (agent_id, owner_user_id, dedupe_key);

create index if not exists agent_owner_notifications_owner_status_idx
  on public.agent_owner_notifications (agent_id, owner_user_id, status, updated_at desc);

create table if not exists public.agent_privacy_settings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  retention_days integer not null default 365,
  delete_unidentified_visitors_after_days integer not null default 90,
  policy_note text,
  widget_identity_guidance text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_privacy_settings_retention_check
    check (retention_days > 0 and delete_unidentified_visitors_after_days > 0)
);

create unique index if not exists agent_privacy_settings_agent_owner_idx
  on public.agent_privacy_settings (agent_id, owner_user_id);

alter table public.agent_human_follow_up_statuses enable row level security;
alter table public.agent_owner_notifications enable row level security;
alter table public.agent_privacy_settings enable row level security;

drop policy if exists "Owners can manage human follow-up statuses." on public.agent_human_follow_up_statuses;
create policy "Owners can manage human follow-up statuses."
  on public.agent_human_follow_up_statuses
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Owners can manage owner notifications." on public.agent_owner_notifications;
create policy "Owners can manage owner notifications."
  on public.agent_owner_notifications
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Owners can manage privacy settings." on public.agent_privacy_settings;
create policy "Owners can manage privacy settings."
  on public.agent_privacy_settings
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Source: supabase/migrations/20260511090000_product_events_owner_dedupe.sql
alter table public.product_events
  add column if not exists owner_user_id uuid,
  add column if not exists dedupe_key text;

create index if not exists product_events_owner_user_id_idx
  on public.product_events (owner_user_id);

create unique index if not exists product_events_dedupe_key_idx
  on public.product_events (dedupe_key)
  where dedupe_key is not null;

-- Source: supabase/migrations/20260511100000_activation_wizard_progress.sql
create table if not exists public.agent_activation_wizard_progress (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid not null,
  current_step text not null default 'business_basics',
  completed_steps text[] not null default '{}',
  skipped_steps text[] not null default '{}',
  exited_at timestamp with time zone,
  completed_at timestamp with time zone,
  import_status text not null default 'idle',
  import_error text,
  test_question text,
  test_quality text not null default 'unknown',
  route_target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_activation_wizard_progress_current_step_check
    check (current_step in ('business_basics', 'import_knowledge', 'configure_assistant', 'install_widget', 'test_improve')),
  constraint agent_activation_wizard_progress_import_status_check
    check (import_status in ('idle', 'running', 'success', 'limited', 'failed')),
  constraint agent_activation_wizard_progress_test_quality_check
    check (test_quality in ('unknown', 'strong', 'needs_improvement'))
);

create unique index if not exists agent_activation_wizard_progress_agent_owner_idx
  on public.agent_activation_wizard_progress (agent_id, owner_user_id);

create index if not exists agent_activation_wizard_progress_owner_user_id_idx
  on public.agent_activation_wizard_progress (owner_user_id);

create index if not exists agent_activation_wizard_progress_updated_at_idx
  on public.agent_activation_wizard_progress (updated_at desc);

alter table public.agent_activation_wizard_progress
  enable row level security;

drop policy if exists "Owners can manage activation wizard progress." on public.agent_activation_wizard_progress;
create policy "Owners can manage activation wizard progress."
  on public.agent_activation_wizard_progress
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260513000000_messages_display_mode.sql
alter table public.messages
  add column if not exists display_mode text not null default 'widget';

alter table public.messages
  drop constraint if exists messages_display_mode_check;

alter table public.messages
  add constraint messages_display_mode_check
  check (display_mode in ('widget', 'page'));

create index if not exists messages_agent_display_mode_created_at_idx
  on public.messages (agent_id, display_mode, created_at desc);

-- Source: supabase/migrations/20260518000000_full_page_assistant_config.sql
-- Legacy source: db/full_page_assistant_config.sql

alter table if exists public.widget_configs
  add column if not exists full_page_config jsonb not null default '{}'::jsonb;

-- Source: supabase/migrations/20260520000000_front_desk_training_items.sql
create table if not exists public.front_desk_training_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  agent_id uuid references public.agents (id) on delete cascade,
  type text not null default 'approved_answer',
  title text,
  trigger_text text,
  answer_text text,
  tags jsonb not null default '[]'::jsonb,
  source_type text not null default 'manual',
  source_message_id uuid,
  status text not null default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint front_desk_training_items_type_check
    check (type in ('approved_answer', 'correction', 'business_fact')),
  constraint front_desk_training_items_source_type_check
    check (source_type in ('manual', 'conversation', 'website', 'test')),
  constraint front_desk_training_items_status_check
    check (status in ('active', 'draft', 'archived'))
);

create index if not exists front_desk_training_items_agent_owner_status_idx
  on public.front_desk_training_items (agent_id, owner_id, status);

create index if not exists front_desk_training_items_agent_type_status_idx
  on public.front_desk_training_items (agent_id, type, status);

alter table public.front_desk_training_items enable row level security;

drop policy if exists "Owners can manage Front Desk training items." on public.front_desk_training_items;
create policy "Owners can manage Front Desk training items."
  on public.front_desk_training_items
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

-- Source: supabase/migrations/20260520001000_extend_reply_feedback_review_loop.sql
alter table public.agent_visitor_reply_feedback
  add column if not exists owner_user_id uuid,
  add column if not exists reason text,
  add column if not exists note text,
  add column if not exists user_question text,
  add column if not exists assistant_answer text,
  add column if not exists display_mode text,
  add column if not exists source_route text,
  add column if not exists source_type text not null default 'visitor_feedback',
  add column if not exists status text not null default 'new',
  add column if not exists training_item_id uuid,
  add column if not exists updated_at timestamp with time zone default now();

alter table public.agent_visitor_reply_feedback
  drop constraint if exists agent_visitor_reply_feedback_reason_check;

alter table public.agent_visitor_reply_feedback
  add constraint agent_visitor_reply_feedback_reason_check
    check (reason is null or reason in ('incorrect', 'missing_details', 'too_vague', 'did_not_answer', 'other'));

alter table public.agent_visitor_reply_feedback
  drop constraint if exists agent_visitor_reply_feedback_source_type_check;

alter table public.agent_visitor_reply_feedback
  add constraint agent_visitor_reply_feedback_source_type_check
    check (source_type in ('visitor_feedback', 'owner_feedback', 'test'));

alter table public.agent_visitor_reply_feedback
  drop constraint if exists agent_visitor_reply_feedback_status_check;

alter table public.agent_visitor_reply_feedback
  add constraint agent_visitor_reply_feedback_status_check
    check (status in ('new', 'queued', 'resolved', 'ignored'));

create index if not exists agent_visitor_reply_feedback_agent_status_idx
  on public.agent_visitor_reply_feedback (agent_id, status, created_at desc);

create index if not exists agent_visitor_reply_feedback_training_item_idx
  on public.agent_visitor_reply_feedback (training_item_id)
  where training_item_id is not null;

update public.agent_visitor_reply_feedback
set owner_user_id = agents.owner_user_id
from public.agents
where agent_visitor_reply_feedback.agent_id = agents.id
  and agent_visitor_reply_feedback.owner_user_id is null;

drop policy if exists "Owners can manage reply feedback for their agents." on public.agent_visitor_reply_feedback;
create policy "Owners can manage reply feedback for their agents."
  on public.agent_visitor_reply_feedback
  for all
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_visitor_reply_feedback.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_visitor_reply_feedback.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

-- Source: supabase/migrations/20260522000000_voice_config.sql
alter table if exists public.widget_configs
  add column if not exists voice_config jsonb not null default '{}'::jsonb;

-- Source: supabase/migrations/20260522001000_front_desk_rag_chunks.sql
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.front_desk_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  source_type text not null,
  source_id text not null default '',
  source_url text,
  title text,
  content text not null,
  content_hash text not null,
  chunk_index integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  embedding_model text,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint front_desk_knowledge_chunks_source_type_check
    check (source_type in ('website', 'business_profile', 'approved_answer', 'manual'))
);

create unique index if not exists front_desk_knowledge_chunks_source_hash_idx
  on public.front_desk_knowledge_chunks (agent_id, source_type, source_id, content_hash, chunk_index);

create index if not exists front_desk_knowledge_chunks_agent_idx
  on public.front_desk_knowledge_chunks (agent_id);

create index if not exists front_desk_knowledge_chunks_owner_idx
  on public.front_desk_knowledge_chunks (owner_user_id);

create index if not exists front_desk_knowledge_chunks_source_type_idx
  on public.front_desk_knowledge_chunks (source_type);

create index if not exists front_desk_knowledge_chunks_active_idx
  on public.front_desk_knowledge_chunks (is_active);

create index if not exists front_desk_knowledge_chunks_content_hash_idx
  on public.front_desk_knowledge_chunks (content_hash);

create index if not exists front_desk_knowledge_chunks_embedding_hnsw_idx
  on public.front_desk_knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

alter table public.front_desk_knowledge_chunks enable row level security;

drop policy if exists "Owners can manage Front Desk knowledge chunks." on public.front_desk_knowledge_chunks;
create policy "Owners can manage Front Desk knowledge chunks."
  on public.front_desk_knowledge_chunks
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

create or replace function public.match_front_desk_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_owner_user_id uuid,
  match_agent_id uuid,
  match_count integer default 6,
  min_similarity double precision default 0.25
)
returns table (
  id uuid,
  owner_user_id uuid,
  agent_id uuid,
  source_type text,
  source_id text,
  source_url text,
  title text,
  content text,
  content_hash text,
  chunk_index integer,
  metadata jsonb,
  embedding_model text,
  similarity double precision,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language sql
stable
as $$
  select
    chunks.id,
    chunks.owner_user_id,
    chunks.agent_id,
    chunks.source_type,
    chunks.source_id,
    chunks.source_url,
    chunks.title,
    chunks.content,
    chunks.content_hash,
    chunks.chunk_index,
    chunks.metadata,
    chunks.embedding_model,
    (1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding))::double precision as similarity,
    chunks.created_at,
    chunks.updated_at
  from public.front_desk_knowledge_chunks chunks
  where chunks.is_active = true
    and chunks.embedding is not null
    and chunks.owner_user_id = match_owner_user_id
    and chunks.agent_id = match_agent_id
    and (1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding)) >= min_similarity
  order by chunks.embedding OPERATOR(extensions.<=>) query_embedding
  limit greatest(1, least(coalesce(match_count, 6), 12));
$$;

revoke all on function public.match_front_desk_knowledge_chunks(extensions.vector(1536), uuid, uuid, integer, double precision) from public;
revoke all on function public.match_front_desk_knowledge_chunks(extensions.vector(1536), uuid, uuid, integer, double precision) from anon;
revoke all on function public.match_front_desk_knowledge_chunks(extensions.vector(1536), uuid, uuid, integer, double precision) from authenticated;
grant execute on function public.match_front_desk_knowledge_chunks(extensions.vector(1536), uuid, uuid, integer, double precision) to service_role;

-- Source: supabase/migrations/20260523000000_enterprise_readiness_hardening.sql

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  admin_email text,
  action text not null,
  target_type text,
  target_id text,
  owner_user_id uuid,
  agent_id uuid references public.agents (id) on delete set null,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists admin_audit_logs_admin_user_id_idx
  on public.admin_audit_logs (admin_user_id, created_at desc);

create index if not exists admin_audit_logs_agent_id_idx
  on public.admin_audit_logs (agent_id, created_at desc)
  where agent_id is not null;

create table if not exists public.website_import_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  owner_user_id uuid,
  website_url text not null,
  status text not null default 'queued',
  attempts integer not null default 1,
  page_count integer,
  content_length integer,
  error_code text,
  error_message text,
  metadata jsonb,
  result jsonb,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint website_import_jobs_status_check
    check (status in ('queued', 'running', 'success', 'limited', 'failed'))
);

create index if not exists website_import_jobs_business_id_idx
  on public.website_import_jobs (business_id, created_at desc);

create index if not exists website_import_jobs_owner_user_id_idx
  on public.website_import_jobs (owner_user_id, created_at desc);

create index if not exists website_import_jobs_agent_id_idx
  on public.website_import_jobs (agent_id, created_at desc)
  where agent_id is not null;

alter table public.admin_audit_logs enable row level security;
alter table public.website_import_jobs enable row level security;

drop policy if exists "Owners can read product events for their agents." on public.product_events;
create policy "Owners can read product events for their agents."
  on public.product_events
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      owner_user_id = (select auth.uid())
      or exists (
        select 1
        from public.agents
        where agents.id = product_events.agent_id
          and agents.owner_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Owners can read import jobs for their agents." on public.website_import_jobs;
create policy "Owners can read import jobs for their agents."
  on public.website_import_jobs
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      owner_user_id = (select auth.uid())
      or exists (
        select 1
        from public.agents
        where agents.id = website_import_jobs.agent_id
          and agents.owner_user_id = (select auth.uid())
      )
    )
  );

-- Source: supabase/migrations/20260523001000_agent_booking_integrations.sql
-- Legacy source: db/agent_booking_integrations.sql

create table if not exists public.agent_booking_integrations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  owner_user_id uuid not null,
  provider text not null default 'calendly',
  status text not null default 'pending',
  booking_url text,
  webhook_endpoint_token_hash text not null,
  webhook_secret_encrypted text,
  provider_account_id text,
  provider_event_type_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_booking_integrations_provider_check
    check (provider in ('calendly')),
  constraint agent_booking_integrations_status_check
    check (status in ('pending', 'active', 'disabled', 'needs_attention'))
);

create unique index if not exists agent_booking_integrations_endpoint_token_idx
  on public.agent_booking_integrations (webhook_endpoint_token_hash);

create unique index if not exists agent_booking_integrations_agent_provider_idx
  on public.agent_booking_integrations (agent_id, owner_user_id, provider);

create index if not exists agent_booking_integrations_agent_owner_idx
  on public.agent_booking_integrations (agent_id, owner_user_id);

create index if not exists agent_booking_integrations_provider_status_idx
  on public.agent_booking_integrations (provider, status);

create index if not exists agent_booking_integrations_provider_account_idx
  on public.agent_booking_integrations (provider, provider_account_id)
  where provider_account_id is not null;

create index if not exists agent_booking_integrations_event_type_idx
  on public.agent_booking_integrations (provider, provider_event_type_id)
  where provider_event_type_id is not null;

alter table public.agent_booking_integrations enable row level security;

drop policy if exists "Owners can manage booking integrations." on public.agent_booking_integrations;
create policy "Owners can manage booking integrations."
  on public.agent_booking_integrations
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260525000000_phone_front_desk_phase_1b.sql

create table if not exists public.agent_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null,
  provider text not null default 'twilio',
  phone_number_e164 text not null,
  label text,
  status text not null default 'pending',
  phone_channel_enabled boolean not null default false,
  greeting_text text,
  disclosure_text text,
  fallback_mode text not null default 'callback_only',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_phone_numbers_provider_check
    check (provider in ('twilio')),
  constraint agent_phone_numbers_status_check
    check (status in ('pending', 'active', 'disabled')),
  constraint agent_phone_numbers_fallback_mode_check
    check (fallback_mode in ('callback_only'))
);

create unique index if not exists agent_phone_numbers_provider_number_idx
  on public.agent_phone_numbers (provider, phone_number_e164);

create index if not exists agent_phone_numbers_agent_owner_idx
  on public.agent_phone_numbers (agent_id, owner_user_id);

create index if not exists agent_phone_numbers_owner_status_idx
  on public.agent_phone_numbers (owner_user_id, status);

create table if not exists public.agent_phone_call_sessions (
  id uuid primary key default gen_random_uuid(),
  phone_number_id uuid not null references public.agent_phone_numbers (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null,
  provider text not null default 'twilio',
  provider_call_sid text not null,
  caller_phone_e164 text,
  called_phone_e164 text,
  status text not null default 'started',
  block_reason text,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_phone_call_sessions_provider_check
    check (provider in ('twilio')),
  constraint agent_phone_call_sessions_status_check
    check (status in ('started', 'greeting', 'completed', 'failed', 'blocked'))
);

create unique index if not exists agent_phone_call_sessions_provider_sid_idx
  on public.agent_phone_call_sessions (provider, provider_call_sid);

create index if not exists agent_phone_call_sessions_phone_number_idx
  on public.agent_phone_call_sessions (phone_number_id, started_at desc);

create index if not exists agent_phone_call_sessions_agent_owner_idx
  on public.agent_phone_call_sessions (agent_id, owner_user_id, started_at desc);

create index if not exists agent_phone_call_sessions_caller_idx
  on public.agent_phone_call_sessions (caller_phone_e164, started_at desc)
  where caller_phone_e164 is not null;

alter table public.agent_phone_numbers enable row level security;
alter table public.agent_phone_call_sessions enable row level security;

drop policy if exists "Owners can manage phone numbers." on public.agent_phone_numbers;
create policy "Owners can manage phone numbers."
  on public.agent_phone_numbers
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage phone call sessions." on public.agent_phone_call_sessions;
create policy "Owners can manage phone call sessions."
  on public.agent_phone_call_sessions
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260528000000_web_call_sessions.sql

create table if not exists public.web_call_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null,
  client_session_key text not null,
  visitor_session_key text,
  display_mode text not null default 'page',
  status text not null default 'started',
  turn_count integer not null default 0,
  duration_seconds integer,
  failure_category text,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  last_event_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint web_call_sessions_display_mode_check
    check (display_mode in ('page')),
  constraint web_call_sessions_status_check
    check (status in ('started', 'active', 'completed', 'failed'))
);

create unique index if not exists web_call_sessions_agent_client_key_idx
  on public.web_call_sessions (agent_id, client_session_key);

create index if not exists web_call_sessions_agent_owner_started_idx
  on public.web_call_sessions (agent_id, owner_user_id, started_at desc);

create index if not exists web_call_sessions_owner_started_idx
  on public.web_call_sessions (owner_user_id, started_at desc);

create table if not exists public.web_call_turn_telemetry (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.web_call_sessions (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null,
  turn_index integer not null,
  status text not null default 'active',
  recording_duration_ms integer,
  upload_latency_ms integer,
  transcription_latency_ms integer,
  assistant_response_latency_ms integer,
  tts_generation_latency_ms integer,
  playback_start_latency_ms integer,
  total_turn_latency_ms integer,
  audio_duration_seconds numeric,
  audio_bytes integer,
  failure_category text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint web_call_turn_telemetry_turn_index_check
    check (turn_index > 0),
  constraint web_call_turn_telemetry_status_check
    check (status in ('active', 'completed', 'failed'))
);

create unique index if not exists web_call_turn_telemetry_session_turn_idx
  on public.web_call_turn_telemetry (session_id, turn_index);

create index if not exists web_call_turn_telemetry_agent_owner_idx
  on public.web_call_turn_telemetry (agent_id, owner_user_id, created_at desc);

alter table public.messages
  add column if not exists web_call_session_id uuid references public.web_call_sessions (id) on delete set null;

create index if not exists messages_web_call_session_id_idx
  on public.messages (web_call_session_id)
  where web_call_session_id is not null;

alter table public.product_events
  add column if not exists web_call_session_id uuid references public.web_call_sessions (id) on delete set null;

create index if not exists product_events_web_call_session_id_idx
  on public.product_events (web_call_session_id)
  where web_call_session_id is not null;

alter table public.web_call_sessions enable row level security;
alter table public.web_call_turn_telemetry enable row level security;

drop policy if exists "Owners can manage Web Call sessions." on public.web_call_sessions;
create policy "Owners can manage Web Call sessions."
  on public.web_call_sessions
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage Web Call turn telemetry." on public.web_call_turn_telemetry;
create policy "Owners can manage Web Call turn telemetry."
  on public.web_call_turn_telemetry
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260528001000_realtime_web_call.sql

alter table public.web_call_sessions
  add column if not exists realtime_mode text,
  add column if not exists realtime_connection_latency_ms integer,
  add column if not exists realtime_first_audio_latency_ms integer,
  add column if not exists realtime_interruption_count integer not null default 0,
  add column if not exists realtime_reconnect_count integer not null default 0,
  add column if not exists realtime_fallback_reason text;

alter table public.web_call_sessions
  drop constraint if exists web_call_sessions_realtime_mode_check;

alter table public.web_call_sessions
  add constraint web_call_sessions_realtime_mode_check
    check (realtime_mode is null or realtime_mode in ('realtime', 'turn_based', 'fallback'));

-- Source: supabase/migrations/20260530000000_owner_product_entitlements.sql
-- Legacy source: db/owner_product_entitlements.sql

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

-- Source: supabase/migrations/20260601145748_agent_package_fields.sql

alter table public.agents
  add column if not exists package_key text not null default 'front_desk_general';

alter table public.agents
  add column if not exists package_version text not null default '0.1.0';

alter table public.agents
  drop constraint if exists agents_package_key_check;

alter table public.agents
  add constraint agents_package_key_check
  check (package_key in ('front_desk_general'));

create index if not exists agents_package_key_idx
  on public.agents (package_key);

-- Source: supabase/migrations/20260601162000_agent_package_hotel_concierge_constraint.sql

alter table public.agents
  drop constraint if exists agents_package_key_check;

alter table public.agents
  add constraint agents_package_key_check
  check (package_key in ('front_desk_general', 'hotel_concierge'));

-- Source: supabase/migrations/20260601185631_agent_action_requests.sql

create table if not exists public.agent_action_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  package_key text not null,
  request_type text not null,
  status text not null default 'new',
  visitor_session_key text,
  conversation_source text,
  display_mode text,
  guest_context jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  source_message text,
  staff_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  accepted_at timestamptz,
  done_at timestamptz,
  dismissed_at timestamptz,
  constraint agent_action_requests_status_check
    check (status in ('new', 'accepted', 'done', 'dismissed')),
  constraint agent_action_requests_package_key_check
    check (package_key in ('front_desk_general', 'hotel_concierge')),
  constraint agent_action_requests_request_type_nonblank_check
    check (length(btrim(request_type)) > 0)
);

create index if not exists agent_action_requests_owner_created_idx
  on public.agent_action_requests (owner_user_id, created_at desc);

create index if not exists agent_action_requests_agent_created_idx
  on public.agent_action_requests (agent_id, created_at desc);

create index if not exists agent_action_requests_owner_status_created_idx
  on public.agent_action_requests (owner_user_id, status, created_at desc);

create index if not exists agent_action_requests_package_type_created_idx
  on public.agent_action_requests (package_key, request_type, created_at desc);

alter table public.agent_action_requests enable row level security;

drop policy if exists "Owners can read action requests." on public.agent_action_requests;
create policy "Owners can read action requests."
  on public.agent_action_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260602135522_agent_booking_requests.sql

create table if not exists public.agent_booking_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  visitor_session_key text,
  source_message_id uuid,
  source_channel text,
  display_mode text,
  requested_service text,
  requested_time_text text,
  requested_time_window_start timestamptz,
  requested_time_window_end timestamptz,
  timezone text,
  customer_name text,
  customer_email text,
  customer_phone text,
  status text not null default 'request_received',
  status_reason text,
  staff_notes text,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_booking_requests_status_check
    check (status in (
      'request_received',
      'needs_info',
      'needs_staff_review',
      'offered',
      'confirmed_externally',
      'declined',
      'cancel_requested',
      'reschedule_requested',
      'cancelled_externally',
      'expired'
    )),
  constraint agent_booking_requests_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint agent_booking_requests_idempotency_key_nonblank_check
    check (idempotency_key is null or length(btrim(idempotency_key)) > 0)
);

create unique index if not exists agent_booking_requests_owner_agent_idempotency_idx
  on public.agent_booking_requests (owner_user_id, agent_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists agent_booking_requests_owner_created_idx
  on public.agent_booking_requests (owner_user_id, created_at desc);

create index if not exists agent_booking_requests_agent_created_idx
  on public.agent_booking_requests (agent_id, created_at desc);

create index if not exists agent_booking_requests_owner_status_created_idx
  on public.agent_booking_requests (owner_user_id, status, created_at desc);

create index if not exists agent_booking_requests_agent_status_created_idx
  on public.agent_booking_requests (agent_id, status, created_at desc);

alter table public.agent_booking_requests enable row level security;

drop policy if exists "Owners can read booking requests." on public.agent_booking_requests;
create policy "Owners can read booking requests."
  on public.agent_booking_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260602150000_connected_app_connection_foundation.sql

create table if not exists public.connected_app_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  provider text not null,
  app_key text not null,
  capability_keys text[] not null default '{}'::text[],
  status text not null default 'needs_setup',
  provider_account_id text,
  provider_account_label text,
  scopes_granted text[] not null default '{}'::text[],
  webhook_status text,
  token_secret_ref text,
  last_verified_at timestamptz,
  needs_attention_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint connected_app_connections_status_check
    check (status in ('needs_setup', 'active', 'disabled', 'needs_attention', 'revoked')),
  constraint connected_app_connections_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint connected_app_connections_app_key_nonblank_check
    check (length(btrim(app_key)) > 0),
  constraint connected_app_connections_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint connected_app_connections_provider_account_id_nonblank_check
    check (provider_account_id is null or length(btrim(provider_account_id)) > 0),
  constraint connected_app_connections_token_secret_ref_nonblank_check
    check (token_secret_ref is null or length(btrim(token_secret_ref)) > 0)
);

create unique index if not exists connected_app_connections_owner_provider_app_account_idx
  on public.connected_app_connections (owner_user_id, provider, app_key, provider_account_id)
  where provider_account_id is not null;

create index if not exists connected_app_connections_owner_status_idx
  on public.connected_app_connections (owner_user_id, status, updated_at desc);

create index if not exists connected_app_connections_provider_app_status_idx
  on public.connected_app_connections (provider, app_key, status);

create table if not exists public.agent_connected_app_enablements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  connection_id uuid not null references public.connected_app_connections (id) on delete cascade,
  capability_keys text[] not null default '{}'::text[],
  enabled boolean not null default false,
  approval_mode text not null default 'manual_review',
  allowed_surfaces text[] not null default '{}'::text[],
  package_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_connected_app_enablements_approval_mode_check
    check (approval_mode in ('manual_review', 'owner_approved', 'automatic_internal', 'disabled')),
  constraint agent_connected_app_enablements_approval_mode_nonblank_check
    check (length(btrim(approval_mode)) > 0),
  constraint agent_connected_app_enablements_package_key_nonblank_check
    check (package_key is null or length(btrim(package_key)) > 0)
);

create index if not exists agent_connected_app_enablements_owner_agent_idx
  on public.agent_connected_app_enablements (owner_user_id, agent_id, updated_at desc);

create index if not exists agent_connected_app_enablements_agent_connection_idx
  on public.agent_connected_app_enablements (agent_id, connection_id);

create index if not exists agent_connected_app_enablements_connection_idx
  on public.agent_connected_app_enablements (connection_id);

create index if not exists agent_connected_app_enablements_owner_enabled_idx
  on public.agent_connected_app_enablements (owner_user_id, enabled, updated_at desc);

alter table public.connected_app_connections enable row level security;
alter table public.agent_connected_app_enablements enable row level security;

drop policy if exists "Owners can read connected app connections." on public.connected_app_connections;
create policy "Owners can read connected app connections."
  on public.connected_app_connections
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read connected app enablements." on public.agent_connected_app_enablements;
create policy "Owners can read connected app enablements."
  on public.agent_connected_app_enablements
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260603105759_connected_app_inbound_events.sql

create table if not exists public.connected_app_inbound_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  connection_id uuid not null references public.connected_app_connections (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  provider text not null,
  app_key text not null,
  capability_key text,
  provider_event_id text,
  provider_event_type text,
  provider_message_id text,
  provider_timestamp timestamptz,
  source_account_id text,
  source_channel_id text,
  event_direction text not null default 'inbound',
  event_status text not null default 'received',
  normalized jsonb not null default '{}'::jsonb,
  redaction_summary jsonb not null default '{}'::jsonb,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint connected_app_inbound_events_direction_check
    check (event_direction in ('inbound')),
  constraint connected_app_inbound_events_status_check
    check (event_status in ('received', 'ignored', 'duplicate', 'invalid')),
  constraint connected_app_inbound_events_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint connected_app_inbound_events_app_key_nonblank_check
    check (length(btrim(app_key)) > 0),
  constraint connected_app_inbound_events_capability_key_nonblank_check
    check (capability_key is null or length(btrim(capability_key)) > 0),
  constraint connected_app_inbound_events_provider_event_id_nonblank_check
    check (provider_event_id is null or length(btrim(provider_event_id)) > 0),
  constraint connected_app_inbound_events_provider_event_type_nonblank_check
    check (provider_event_type is null or length(btrim(provider_event_type)) > 0),
  constraint connected_app_inbound_events_provider_message_id_nonblank_check
    check (provider_message_id is null or length(btrim(provider_message_id)) > 0),
  constraint connected_app_inbound_events_source_account_id_nonblank_check
    check (source_account_id is null or length(btrim(source_account_id)) > 0),
  constraint connected_app_inbound_events_source_channel_id_nonblank_check
    check (source_channel_id is null or length(btrim(source_channel_id)) > 0),
  constraint connected_app_inbound_events_dedupe_key_nonblank_check
    check (dedupe_key is null or length(btrim(dedupe_key)) > 0)
);

create unique index if not exists connected_app_inbound_events_owner_provider_dedupe_idx
  on public.connected_app_inbound_events (owner_user_id, provider, dedupe_key)
  where dedupe_key is not null;

create index if not exists connected_app_inbound_events_owner_created_idx
  on public.connected_app_inbound_events (owner_user_id, created_at desc);

create index if not exists connected_app_inbound_events_connection_created_idx
  on public.connected_app_inbound_events (connection_id, created_at desc);

create index if not exists connected_app_inbound_events_provider_event_idx
  on public.connected_app_inbound_events (provider, app_key, provider_event_type, created_at desc);

create index if not exists connected_app_inbound_events_provider_message_idx
  on public.connected_app_inbound_events (provider, provider_message_id)
  where provider_message_id is not null;

alter table public.connected_app_inbound_events enable row level security;

drop policy if exists "Owners can read connected app inbound events." on public.connected_app_inbound_events;
create policy "Owners can read connected app inbound events."
  on public.connected_app_inbound_events
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260603133000_connected_app_inbound_threads.sql

create table if not exists public.connected_app_inbound_threads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  connection_id uuid not null references public.connected_app_connections (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  provider text not null,
  app_key text not null,
  capability_key text,
  external_thread_key_hash text not null,
  external_thread_label text not null,
  status text not null default 'open',
  last_event_id uuid references public.connected_app_inbound_events (id) on delete set null,
  last_event_at timestamptz,
  last_event_type text,
  last_message_type text,
  unread_count integer not null default 0,
  assigned_owner_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint connected_app_inbound_threads_status_check
    check (status in ('open', 'reviewing', 'resolved', 'ignored', 'archived')),
  constraint connected_app_inbound_threads_unread_count_check
    check (unread_count >= 0),
  constraint connected_app_inbound_threads_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint connected_app_inbound_threads_app_key_nonblank_check
    check (length(btrim(app_key)) > 0),
  constraint connected_app_inbound_threads_capability_key_nonblank_check
    check (capability_key is null or length(btrim(capability_key)) > 0),
  constraint connected_app_inbound_threads_external_key_hash_nonblank_check
    check (length(btrim(external_thread_key_hash)) > 0),
  constraint connected_app_inbound_threads_external_label_nonblank_check
    check (length(btrim(external_thread_label)) > 0),
  constraint connected_app_inbound_threads_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint connected_app_inbound_threads_last_event_type_nonblank_check
    check (last_event_type is null or length(btrim(last_event_type)) > 0),
  constraint connected_app_inbound_threads_last_message_type_nonblank_check
    check (last_message_type is null or length(btrim(last_message_type)) > 0)
);

create unique index if not exists connected_app_inbound_threads_owner_external_idx
  on public.connected_app_inbound_threads (
    owner_user_id,
    connection_id,
    provider,
    app_key,
    coalesce(capability_key, ''),
    coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    external_thread_key_hash
  );

create index if not exists connected_app_inbound_threads_owner_status_last_idx
  on public.connected_app_inbound_threads (owner_user_id, status, last_event_at desc);

create index if not exists connected_app_inbound_threads_connection_last_idx
  on public.connected_app_inbound_threads (connection_id, last_event_at desc);

create index if not exists connected_app_inbound_threads_owner_agent_status_idx
  on public.connected_app_inbound_threads (owner_user_id, agent_id, status, last_event_at desc)
  where agent_id is not null;

alter table public.connected_app_inbound_events
  add column if not exists thread_id uuid;

create index if not exists connected_app_inbound_events_thread_created_idx
  on public.connected_app_inbound_events (thread_id, created_at desc)
  where thread_id is not null;

alter table public.connected_app_inbound_threads enable row level security;

revoke all on table public.connected_app_inbound_threads from anon;
grant select on table public.connected_app_inbound_threads to authenticated;

drop policy if exists "Owners can read connected app inbound threads." on public.connected_app_inbound_threads;
create policy "Owners can read connected app inbound threads."
  on public.connected_app_inbound_threads
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260603133840_connected_app_outbound_messages.sql

create table if not exists public.connected_app_outbound_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  connection_id uuid not null references public.connected_app_connections (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  thread_id uuid not null references public.connected_app_inbound_threads (id) on delete cascade,
  provider text not null,
  app_key text not null,
  capability_key text not null,
  destination_ref_hash text not null,
  message_type text not null,
  body_redacted text,
  template_name text,
  template_language text,
  status text not null default 'blocked',
  approval_mode text not null default 'manual_staff',
  provider_message_id text,
  provider_status text,
  error_code text,
  error_message_redacted text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_owner_user_id uuid not null,
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint connected_app_outbound_messages_message_type_check
    check (message_type in ('text', 'template')),
  constraint connected_app_outbound_messages_status_check
    check (status in ('draft', 'queued', 'sent', 'failed', 'blocked')),
  constraint connected_app_outbound_messages_provider_nonblank_check
    check (length(btrim(provider)) > 0),
  constraint connected_app_outbound_messages_app_key_nonblank_check
    check (length(btrim(app_key)) > 0),
  constraint connected_app_outbound_messages_capability_key_nonblank_check
    check (length(btrim(capability_key)) > 0),
  constraint connected_app_outbound_messages_destination_ref_hash_nonblank_check
    check (length(btrim(destination_ref_hash)) > 0),
  constraint connected_app_outbound_messages_message_type_nonblank_check
    check (length(btrim(message_type)) > 0),
  constraint connected_app_outbound_messages_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint connected_app_outbound_messages_approval_mode_nonblank_check
    check (length(btrim(approval_mode)) > 0),
  constraint connected_app_outbound_messages_template_name_nonblank_check
    check (template_name is null or length(btrim(template_name)) > 0),
  constraint connected_app_outbound_messages_template_language_nonblank_check
    check (template_language is null or length(btrim(template_language)) > 0),
  constraint connected_app_outbound_messages_provider_message_id_nonblank_check
    check (provider_message_id is null or length(btrim(provider_message_id)) > 0),
  constraint connected_app_outbound_messages_provider_status_nonblank_check
    check (provider_status is null or length(btrim(provider_status)) > 0),
  constraint connected_app_outbound_messages_error_code_nonblank_check
    check (error_code is null or length(btrim(error_code)) > 0),
  constraint connected_app_outbound_messages_error_message_redacted_nonblank_check
    check (error_message_redacted is null or length(btrim(error_message_redacted)) > 0)
);

create index if not exists connected_app_outbound_messages_owner_created_idx
  on public.connected_app_outbound_messages (owner_user_id, created_at desc);

create index if not exists connected_app_outbound_messages_thread_created_idx
  on public.connected_app_outbound_messages (thread_id, created_at desc);

create index if not exists connected_app_outbound_messages_connection_status_idx
  on public.connected_app_outbound_messages (connection_id, status, created_at desc);

create index if not exists connected_app_outbound_messages_owner_agent_created_idx
  on public.connected_app_outbound_messages (owner_user_id, agent_id, created_at desc)
  where agent_id is not null;

alter table public.connected_app_outbound_messages enable row level security;

revoke all on table public.connected_app_outbound_messages from anon;
grant select on table public.connected_app_outbound_messages to authenticated;

drop policy if exists "Owners can read connected app outbound messages." on public.connected_app_outbound_messages;
create policy "Owners can read connected app outbound messages."
  on public.connected_app_outbound_messages
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260603143000_whatsapp_ai_reply_draft_context.sql

alter table public.connected_app_inbound_events
  add column if not exists normalized_message_text text;

alter table public.connected_app_inbound_events
  drop constraint if exists connected_app_inbound_events_normalized_message_text_check;

alter table public.connected_app_inbound_events
  add constraint connected_app_inbound_events_normalized_message_text_check
    check (
      normalized_message_text is null
      or (
        provider = 'whatsapp'
        and provider_event_type = 'message'
        and event_direction = 'inbound'
        and event_status = 'received'
        and normalized_message_text = btrim(normalized_message_text)
        and length(normalized_message_text) between 1 and 1500
        and normalized_message_text !~* '(https?://|www[.])'
        and normalized_message_text !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}'
        and normalized_message_text !~* '([+]?[0-9][0-9[:space:]().-]{6,}[0-9])'
        and normalized_message_text !~* '((sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}|EAA[A-Za-z0-9_-]{20,})'
        and normalized_message_text !~* 'eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}'
      )
    );

create index if not exists connected_app_inbound_events_thread_message_context_idx
  on public.connected_app_inbound_events (owner_user_id, thread_id, created_at desc)
  where normalized_message_text is not null;

-- Source: supabase/migrations/20260604120000_agent_quote_requests.sql

create table if not exists public.agent_quote_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  visitor_session_key text,
  source_message_id uuid,
  source_channel text,
  display_mode text,
  requested_service text,
  project_details text,
  location_text text,
  urgency text,
  budget_text text,
  customer_name text,
  customer_email text,
  customer_phone text,
  language text,
  status text not null default 'request_received',
  status_reason text,
  staff_notes text,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_quote_requests_status_check
    check (status in (
      'request_received',
      'needs_info',
      'needs_staff_review',
      'quoted_externally',
      'declined',
      'accepted_externally',
      'cancel_requested',
      'expired',
      'archived'
    )),
  constraint agent_quote_requests_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint agent_quote_requests_idempotency_key_nonblank_check
    check (idempotency_key is null or length(btrim(idempotency_key)) > 0)
);

create unique index if not exists agent_quote_requests_owner_agent_idempotency_idx
  on public.agent_quote_requests (owner_user_id, agent_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists agent_quote_requests_owner_created_idx
  on public.agent_quote_requests (owner_user_id, created_at desc);

create index if not exists agent_quote_requests_agent_created_idx
  on public.agent_quote_requests (agent_id, created_at desc);

create index if not exists agent_quote_requests_owner_status_created_idx
  on public.agent_quote_requests (owner_user_id, status, created_at desc);

create index if not exists agent_quote_requests_agent_status_created_idx
  on public.agent_quote_requests (agent_id, status, created_at desc);

alter table public.agent_quote_requests enable row level security;

revoke all on table public.agent_quote_requests from anon;
grant select on table public.agent_quote_requests to authenticated;

drop policy if exists "Owners can read quote requests." on public.agent_quote_requests;
create policy "Owners can read quote requests."
  on public.agent_quote_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260604143000_qdh_owner_setups.sql

create table if not exists public.qdh_owner_setups (
  owner_user_id uuid primary key,
  business_name text not null,
  website_url text not null,
  service_type text not null,
  service_area text not null,
  handling_preference text not null default 'staff_review',
  owner_contact_email text not null,
  services_offered text[] not null default '{}'::text[],
  setup_status text not null default 'ready_for_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint qdh_owner_setups_handling_preference_check
    check (handling_preference in ('staff_review', 'email_review', 'phone_review')),
  constraint qdh_owner_setups_setup_status_check
    check (setup_status in ('ready_for_review')),
  constraint qdh_owner_setups_business_name_nonblank_check
    check (length(btrim(business_name)) > 0),
  constraint qdh_owner_setups_website_url_nonblank_check
    check (length(btrim(website_url)) > 0),
  constraint qdh_owner_setups_services_offered_nonempty_check
    check (array_length(services_offered, 1) > 0)
);

create index if not exists qdh_owner_setups_updated_at_idx
  on public.qdh_owner_setups (updated_at desc);

alter table public.qdh_owner_setups enable row level security;

drop policy if exists "Owners can manage QDH setup." on public.qdh_owner_setups;
create policy "Owners can manage QDH setup."
  on public.qdh_owner_setups
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260605120000_enterprise_request_desk_requests.sql

create table if not exists public.enterprise_request_desk_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  source_key_hash text,
  lane text not null default 'general_enquiry',
  lane_label text not null default 'Általános érdeklődés',
  confidence text not null default 'low',
  request_text text,
  site_or_object text,
  location_text text,
  service_need text,
  timing_text text,
  urgency text,
  contact_name text,
  contact_email text,
  contact_phone text,
  missing_fields text[] not null default '{}'::text[],
  structured_brief jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'request_received',
  staff_notes text,
  status_reason text,
  idempotency_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint enterprise_request_desk_requests_lane_check
    check (lane in (
      'security_guarding',
      'reception_object_protection',
      'facility_management',
      'security_technology',
      'audit_compliance',
      'mixed_enterprise_request',
      'general_enquiry'
    )),
  constraint enterprise_request_desk_requests_confidence_check
    check (confidence in ('high', 'medium', 'low')),
  constraint enterprise_request_desk_requests_status_check
    check (status in (
      'request_received',
      'needs_info',
      'needs_staff_review',
      'routed',
      'declined',
      'archived'
    )),
  constraint enterprise_request_desk_requests_status_nonblank_check
    check (length(btrim(status)) > 0),
  constraint enterprise_request_desk_requests_idempotency_key_nonblank_check
    check (idempotency_key is null or length(btrim(idempotency_key)) > 0),
  constraint enterprise_request_desk_requests_missing_fields_check
    check (
      missing_fields <@ array[
        'service_need',
        'location_or_site',
        'urgency_or_timing',
        'contact_need'
      ]::text[]
    )
);

create unique index if not exists enterprise_request_desk_requests_owner_agent_idempotency_idx
  on public.enterprise_request_desk_requests (owner_user_id, agent_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists enterprise_request_desk_requests_owner_created_idx
  on public.enterprise_request_desk_requests (owner_user_id, created_at desc);

create index if not exists enterprise_request_desk_requests_agent_created_idx
  on public.enterprise_request_desk_requests (agent_id, created_at desc);

create index if not exists enterprise_request_desk_requests_owner_status_created_idx
  on public.enterprise_request_desk_requests (owner_user_id, status, created_at desc);

create index if not exists enterprise_request_desk_requests_agent_status_created_idx
  on public.enterprise_request_desk_requests (agent_id, status, created_at desc);

create index if not exists enterprise_request_desk_requests_owner_lane_created_idx
  on public.enterprise_request_desk_requests (owner_user_id, lane, created_at desc);

alter table public.enterprise_request_desk_requests enable row level security;

revoke all on table public.enterprise_request_desk_requests from anon;
grant select on table public.enterprise_request_desk_requests to authenticated;

drop policy if exists "Owners can read Enterprise Request Desk requests." on public.enterprise_request_desk_requests;
create policy "Owners can read Enterprise Request Desk requests."
  on public.enterprise_request_desk_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260605153000_enterprise_request_desk_owner_setups.sql

create table if not exists public.enterprise_request_desk_owner_setups (
  owner_user_id uuid primary key,
  organization_name text not null,
  website_url text not null,
  service_area text not null,
  service_lines text[] not null default '{}'::text[],
  intake_positioning text not null default 'qualified_enterprise_intake',
  routing_preference text not null default 'internal_handoff',
  owner_contact_email text not null,
  setup_status text not null default 'ready_for_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint enterprise_request_desk_owner_setups_routing_preference_check
    check (routing_preference in ('internal_handoff', 'email_triage', 'phone_followup')),
  constraint enterprise_request_desk_owner_setups_setup_status_check
    check (setup_status in ('ready_for_review')),
  constraint enterprise_request_desk_owner_setups_organization_name_nonblank_check
    check (length(btrim(organization_name)) > 0),
  constraint enterprise_request_desk_owner_setups_website_url_nonblank_check
    check (length(btrim(website_url)) > 0),
  constraint enterprise_request_desk_owner_setups_service_area_nonblank_check
    check (length(btrim(service_area)) > 0),
  constraint enterprise_request_desk_owner_setups_service_lines_nonempty_check
    check (array_length(service_lines, 1) > 0),
  constraint enterprise_request_desk_owner_setups_owner_contact_email_nonblank_check
    check (length(btrim(owner_contact_email)) > 0)
);

create index if not exists enterprise_request_desk_owner_setups_updated_at_idx
  on public.enterprise_request_desk_owner_setups (updated_at desc);

alter table public.enterprise_request_desk_owner_setups enable row level security;

revoke all on table public.enterprise_request_desk_owner_setups from anon;
grant select, insert, update, delete on table public.enterprise_request_desk_owner_setups to authenticated;

drop policy if exists "Owners can manage Enterprise Request Desk setup." on public.enterprise_request_desk_owner_setups;
create policy "Owners can manage Enterprise Request Desk setup."
  on public.enterprise_request_desk_owner_setups
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

-- Source: supabase/migrations/20260612110000_widget_early_access_waitlist.sql
create table if not exists public.widget_early_access_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  focus_area text not null,
  website_url text not null,
  contact_email text,
  contact_phone text,
  contact_raw text not null,
  application_fingerprint text not null,
  status text not null default 'new',
  locale text not null default 'hu-HU',
  source text not null default 'widget_early_access_waitlist',
  source_host text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint widget_early_access_contact_check
    check (contact_email is not null or contact_phone is not null),
  constraint widget_early_access_status_check
    check (status in ('new', 'reviewed', 'invited', 'declined', 'archived'))
);

create unique index if not exists widget_early_access_applications_fingerprint_idx
  on public.widget_early_access_applications (application_fingerprint);

create index if not exists widget_early_access_applications_status_created_idx
  on public.widget_early_access_applications (status, created_at desc);

create index if not exists widget_early_access_applications_created_idx
  on public.widget_early_access_applications (created_at desc);

alter table public.widget_early_access_applications enable row level security;

drop policy if exists "Service role manages widget early access applications." on public.widget_early_access_applications;
create policy "Service role manages widget early access applications."
  on public.widget_early_access_applications
  for all
  to service_role
  using (true)
  with check (true);

-- Source: supabase/migrations/20260612130000_agent_knowledge_files.sql
create table if not exists public.agent_knowledge_files (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  original_filename text not null,
  stored_filename text not null,
  file_extension text not null,
  mime_type text not null,
  byte_size integer not null default 0,
  content_hash text not null,
  extracted_character_count integer not null default 0,
  chunk_count integer not null default 0,
  status text not null default 'indexing',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamp with time zone,
  last_indexed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint agent_knowledge_files_status_check
    check (status in ('indexing', 'ready', 'failed', 'archived')),
  constraint agent_knowledge_files_extension_check
    check (file_extension in ('txt', 'md', 'csv', 'json')),
  constraint agent_knowledge_files_byte_size_check
    check (byte_size >= 0 and byte_size <= 1048576),
  constraint agent_knowledge_files_extracted_character_count_check
    check (extracted_character_count >= 0 and extracted_character_count <= 200000),
  constraint agent_knowledge_files_chunk_count_check
    check (chunk_count >= 0)
);

create index if not exists agent_knowledge_files_agent_id_idx
  on public.agent_knowledge_files (agent_id);

create index if not exists agent_knowledge_files_owner_user_id_idx
  on public.agent_knowledge_files (owner_user_id);

create index if not exists agent_knowledge_files_status_idx
  on public.agent_knowledge_files (status);

create index if not exists agent_knowledge_files_created_at_idx
  on public.agent_knowledge_files (created_at desc);

create index if not exists agent_knowledge_files_agent_status_created_idx
  on public.agent_knowledge_files (agent_id, status, created_at desc);

alter table public.agent_knowledge_files enable row level security;

drop policy if exists "Owners can manage agent knowledge files." on public.agent_knowledge_files;
create policy "Owners can manage agent knowledge files."
  on public.agent_knowledge_files
  for all
  to authenticated
  using (
    (select auth.uid()) is not null
    and owner_user_id = (select auth.uid())
    and exists (
      select 1
      from public.agents
      where agents.id = agent_knowledge_files.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and owner_user_id = (select auth.uid())
    and exists (
      select 1
      from public.agents
      where agents.id = agent_knowledge_files.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

-- Source: supabase/migrations/20260612153000_website_import_structured_facts.sql
alter table public.website_content
  add column if not exists structured_facts jsonb not null default '{}'::jsonb;

alter table public.front_desk_knowledge_chunks
  drop constraint if exists front_desk_knowledge_chunks_source_type_check;

alter table public.front_desk_knowledge_chunks
  add constraint front_desk_knowledge_chunks_source_type_check
  check (source_type in ('website', 'website_structured', 'business_profile', 'approved_answer', 'manual'));

-- Source: supabase/migrations/20260612170000_website_content_pages.sql
create table if not exists public.website_content_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  import_job_id uuid references public.website_import_jobs (id) on delete set null,
  website_url text,
  page_url text not null,
  page_title text,
  meta_description text,
  content text not null default '',
  structured_facts jsonb not null default '{}'::jsonb,
  content_hash text not null,
  status text not null default 'imported',
  error_code text,
  js_fallback_used boolean not null default false,
  page_index integer not null default 0,
  content_length integer not null default 0,
  imported_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint website_content_pages_status_check
    check (status in ('imported', 'failed', 'skipped'))
);

create unique index if not exists website_content_pages_business_page_url_idx
  on public.website_content_pages (business_id, page_url);

create index if not exists website_content_pages_business_page_index_idx
  on public.website_content_pages (business_id, page_index);

create index if not exists website_content_pages_import_job_id_idx
  on public.website_content_pages (import_job_id)
  where import_job_id is not null;

create index if not exists website_content_pages_status_idx
  on public.website_content_pages (status);

alter table public.website_content_pages enable row level security;

drop policy if exists "Owners can read website content pages for their agents." on public.website_content_pages;
create policy "Owners can read website content pages for their agents."
  on public.website_content_pages
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.business_id = website_content_pages.business_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

-- Source: supabase/migrations/20260612183000_agent_custom_instructions.sql
alter table public.agents
  add column if not exists custom_instructions text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agents_custom_instructions_length_check'
      and conrelid = 'public.agents'::regclass
  ) then
    alter table public.agents
      add constraint agents_custom_instructions_length_check
      check (custom_instructions is null or char_length(custom_instructions) <= 10000);
  end if;
end $$;
