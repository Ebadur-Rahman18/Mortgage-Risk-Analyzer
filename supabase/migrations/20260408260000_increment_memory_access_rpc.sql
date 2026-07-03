-- Atomic memory access stats update used by retrieve-agent-memories.
create or replace function public.increment_memory_access(p_memory_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.agent_memories
  set
    access_count = access_count + 1,
    last_accessed_at = now(),
    updated_at = now()
  where id = any(p_memory_ids);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

comment on function public.increment_memory_access(uuid[]) is
  'Atomically increments access_count and updates last_accessed_at for agent memories.';
