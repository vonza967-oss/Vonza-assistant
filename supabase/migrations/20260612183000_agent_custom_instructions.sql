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
