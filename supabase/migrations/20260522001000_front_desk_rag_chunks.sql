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
