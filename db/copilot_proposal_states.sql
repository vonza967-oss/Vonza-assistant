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
