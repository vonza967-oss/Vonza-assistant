alter table public.website_content
  add column if not exists structured_facts jsonb not null default '{}'::jsonb;

alter table public.front_desk_knowledge_chunks
  drop constraint if exists front_desk_knowledge_chunks_source_type_check;

alter table public.front_desk_knowledge_chunks
  add constraint front_desk_knowledge_chunks_source_type_check
  check (source_type in ('website', 'website_structured', 'business_profile', 'approved_answer', 'manual'));
