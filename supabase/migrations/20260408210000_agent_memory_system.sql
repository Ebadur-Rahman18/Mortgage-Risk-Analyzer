-- ──────────────────────────────────────────────────────────────────────────────
-- Agent Memory System (L1)
--
-- Creates the agent_memories table with pgvector for semantic retrieval.
-- This is the prerequisite for the full memory pipeline:
--   extract-agent-memories → agent_memories → retrieve-agent-memories
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable pgvector (no-op if already enabled)
create extension if not exists vector;

-- ── agent_memories ────────────────────────────────────────────────────────────
create table if not exists public.agent_memories (
  id                  uuid        primary key default gen_random_uuid(),
  agent_id            uuid        not null references public.ai_agents(id)          on delete cascade,
  user_id             uuid        not null references auth.users(id)                on delete cascade,
  conversation_id     uuid                    references public.agent_conversations(id) on delete set null,
  memory_type         text        not null default 'short_term',  -- 'short_term' | 'long_term'
  content             text        not null,
  embedding           vector(1536),            -- OpenAI text-embedding-3-small / ada-002
  importance_score    float       not null default 0.5,
  access_count        integer     not null default 0,
  last_accessed_at    timestamptz,
  expires_at          timestamptz,             -- null = permanent (long-term); set for short-term
  metadata            jsonb       not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary lookup: all memories for a given agent + user
create index if not exists agent_memories_agent_user_idx
  on public.agent_memories (agent_id, user_id, memory_type);

-- HNSW index for fast approximate nearest-neighbour cosine similarity search.
-- Only index rows that have been embedded.
create index if not exists agent_memories_embedding_hnsw_idx
  on public.agent_memories using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

-- Partial index for TTL cleanup cron job
create index if not exists agent_memories_expires_idx
  on public.agent_memories (expires_at)
  where expires_at is not null;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.agent_memories enable row level security;

-- Users see only their own memories
create policy "Users can read own memories"
  on public.agent_memories for select
  using (auth.uid() = user_id);

create policy "Users can insert own memories"
  on public.agent_memories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own memories"
  on public.agent_memories for update
  using (auth.uid() = user_id);

create policy "Users can delete own memories"
  on public.agent_memories for delete
  using (auth.uid() = user_id);

-- Admins see all memories
create policy "Admins can manage all memories"
  on public.agent_memories for all
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.update_agent_memories_updated_at()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_agent_memories_updated_at
  before update on public.agent_memories
  for each row execute function public.update_agent_memories_updated_at();

-- ── RPC: semantic memory search ───────────────────────────────────────────────
-- Called by retrieve-agent-memories edge function using service role key,
-- so it bypasses RLS and searches across the supplied user's memories only.
create or replace function public.search_agent_memories(
  p_agent_id        uuid,
  p_user_id         uuid,
  p_query_embedding vector(1536),
  p_limit           integer default 5,
  p_memory_types    text[]  default array['short_term', 'long_term']
)
returns table (
  id               uuid,
  content          text,
  memory_type      text,
  importance_score float,
  similarity       float,
  created_at       timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    m.id,
    m.content,
    m.memory_type,
    m.importance_score,
    1 - (m.embedding <=> p_query_embedding) as similarity,
    m.created_at
  from public.agent_memories m
  where m.agent_id     = p_agent_id
    and m.user_id      = p_user_id
    and m.embedding    is not null
    and m.memory_type  = any(p_memory_types)
    and (m.expires_at  is null or m.expires_at > now())
  order by m.embedding <=> p_query_embedding
  limit p_limit;
$$;
