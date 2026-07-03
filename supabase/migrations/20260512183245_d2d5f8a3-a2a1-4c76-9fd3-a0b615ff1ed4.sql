-- user_invites table
CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_email   ON public.user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_token   ON public.user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires ON public.user_invites(expires_at);

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_invites' AND policyname = 'Admins manage invites'
  ) THEN
    CREATE POLICY "Admins manage invites"
      ON public.user_invites FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- Seed Loan Officer + Manager custom roles
INSERT INTO public.roles (name, description, permissions)
VALUES
  ('Loan Officer',
   'Manages own loan pipeline. Can use AI agents, borrower management, and HubSpot pipeline views.',
   '["loans:read","loans:create","loans:update","borrowers:read","borrowers:create","borrowers:update","tasks:read","tasks:create","tasks:update","tasks:assign","knowledge:read","ai_chat:read","pricing:read","pricing:calculate","rate_locks:read"]'::jsonb),
  ('Manager',
   'Branch manager. Full pipeline visibility, all Loan Officer permissions, plus team management.',
   '["loans:read","loans:create","loans:update","loans:delete","borrowers:read","borrowers:create","borrowers:update","tasks:read","tasks:create","tasks:update","tasks:assign","knowledge:read","knowledge:create","ai_chat:read","pricing:read","pricing:calculate","rate_locks:read","rate_locks:manage"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- agent_memories table + helper functions (combined for atomic apply)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL DEFAULT 'short_term'
    CHECK (memory_type IN ('short_term','long_term','episodic','semantic')),
  memory_category TEXT
    CHECK (memory_category IN ('fact','preference','summary','decision','pattern')),
  content TEXT NOT NULL,
  embedding vector(1536),
  source_type TEXT DEFAULT 'conversation',
  source_id UUID,
  importance_score FLOAT NOT NULL DEFAULT 0.5 CHECK (importance_score BETWEEN 0 AND 1),
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  consolidated BOOLEAN NOT NULL DEFAULT false,
  superseded_by UUID REFERENCES public.agent_memories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_user ON public.agent_memories(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_active ON public.agent_memories(agent_id, user_id, is_active);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_memories' AND policyname='Users see own memories') THEN
    CREATE POLICY "Users see own memories" ON public.agent_memories FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_memories' AND policyname='Users insert own memories') THEN
    CREATE POLICY "Users insert own memories" ON public.agent_memories FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_memories' AND policyname='Users update own memories') THEN
    CREATE POLICY "Users update own memories" ON public.agent_memories FOR UPDATE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_relevant_memories(
  p_agent_id UUID, p_user_id UUID, query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.5, match_count INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, memory_category TEXT, memory_type TEXT, importance_score FLOAT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.content, m.memory_category, m.memory_type, m.importance_score,
         1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memories m
  WHERE m.agent_id = p_agent_id AND m.user_id = p_user_id AND m.is_active = true
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) >= match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END; $$;

CREATE OR REPLACE FUNCTION public.increment_memory_access(memory_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.agent_memories
  SET access_count = access_count + 1, last_accessed_at = now(), updated_at = now()
  WHERE id = ANY(memory_ids);
END; $$;

CREATE OR REPLACE FUNCTION public.consolidate_short_term_memories(
  p_agent_id UUID, p_user_id UUID, days_old INT DEFAULT 7
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_count INTEGER;
BEGIN
  UPDATE public.agent_memories
  SET memory_type='long_term', consolidated=true, updated_at=now()
  WHERE agent_id=p_agent_id AND user_id=p_user_id AND memory_type='short_term'
    AND is_active=true AND access_count>=1 AND importance_score>=0.3
    AND created_at <= now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END; $$;

CREATE OR REPLACE FUNCTION public.prune_short_term_memories(
  p_agent_id UUID, p_user_id UUID, days_old INT DEFAULT 30, importance_threshold FLOAT DEFAULT 0.2
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pruned_count INTEGER;
BEGIN
  UPDATE public.agent_memories
  SET is_active=false, updated_at=now()
  WHERE agent_id=p_agent_id AND user_id=p_user_id AND memory_type='short_term'
    AND is_active=true AND access_count=0 AND importance_score < importance_threshold
    AND created_at <= now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END; $$;