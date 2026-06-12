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
