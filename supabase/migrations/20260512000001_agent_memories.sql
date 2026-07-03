-- ============================================================================
-- agent_memories table + SQL helper functions
-- Required for AI agent memory layer (retrieve-agent-memories /
-- extract-agent-memories edge functions)
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE throughout)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. agent_memories table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL DEFAULT 'short_term'
    CHECK (memory_type IN ('short_term', 'long_term', 'episodic', 'semantic')),
  memory_category TEXT
    CHECK (memory_category IN ('fact', 'preference', 'summary', 'decision', 'pattern')),
  content TEXT NOT NULL,
  embedding vector(1536),
  source_type TEXT DEFAULT 'conversation',
  source_id UUID,
  importance_score FLOAT NOT NULL DEFAULT 0.5
    CHECK (importance_score BETWEEN 0 AND 1),
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  consolidated BOOLEAN NOT NULL DEFAULT false,
  superseded_by UUID REFERENCES public.agent_memories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_memories IS
  'Per-user, per-agent memory store. short_term memories are promoted to long_term after use.';

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_user
  ON public.agent_memories(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_active
  ON public.agent_memories(agent_id, user_id, is_active);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_memories' AND policyname = 'Users see own memories'
  ) THEN
    CREATE POLICY "Users see own memories"
      ON public.agent_memories FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.has_role('admin'::public.app_role, auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_memories' AND policyname = 'Users insert own memories'
  ) THEN
    CREATE POLICY "Users insert own memories"
      ON public.agent_memories FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_memories' AND policyname = 'Users update own memories'
  ) THEN
    CREATE POLICY "Users update own memories"
      ON public.agent_memories FOR UPDATE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ── 2. get_relevant_memories — vector similarity search ──────────────────────

CREATE OR REPLACE FUNCTION public.get_relevant_memories(
  p_agent_id UUID,
  p_user_id  UUID,
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id               UUID,
  content          TEXT,
  memory_category  TEXT,
  memory_type      TEXT,
  importance_score FLOAT,
  similarity       FLOAT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.memory_category,
    m.memory_type,
    m.importance_score,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memories m
  WHERE
    m.agent_id  = p_agent_id
    AND m.user_id   = p_user_id
    AND m.is_active = true
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) >= match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── 3. increment_memory_access — update stats atomically ─────────────────────

CREATE OR REPLACE FUNCTION public.increment_memory_access(memory_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_memories
  SET
    access_count    = access_count + 1,
    last_accessed_at = now(),
    updated_at       = now()
  WHERE id = ANY(memory_ids);
END;
$$;

-- ── 4. consolidate_short_term_memories — promote old short_term → long_term ──

CREATE OR REPLACE FUNCTION public.consolidate_short_term_memories(
  p_agent_id UUID,
  p_user_id  UUID,
  days_old   INT DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.agent_memories
  SET
    memory_type  = 'long_term',
    consolidated = true,
    updated_at   = now()
  WHERE
    agent_id    = p_agent_id
    AND user_id     = p_user_id
    AND memory_type = 'short_term'
    AND is_active   = true
    AND access_count >= 1
    AND importance_score >= 0.3
    AND created_at <= now() - (days_old || ' days')::interval;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ── 5. prune_short_term_memories — soft-delete stale low-value memories ──────

CREATE OR REPLACE FUNCTION public.prune_short_term_memories(
  p_agent_id           UUID,
  p_user_id            UUID,
  days_old             INT   DEFAULT 30,
  importance_threshold FLOAT DEFAULT 0.2
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pruned_count INTEGER;
BEGIN
  UPDATE public.agent_memories
  SET
    is_active  = false,
    updated_at = now()
  WHERE
    agent_id        = p_agent_id
    AND user_id         = p_user_id
    AND memory_type     = 'short_term'
    AND is_active       = true
    AND access_count    = 0
    AND importance_score < importance_threshold
    AND created_at      <= now() - (days_old || ' days')::interval;

  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END;
$$;
