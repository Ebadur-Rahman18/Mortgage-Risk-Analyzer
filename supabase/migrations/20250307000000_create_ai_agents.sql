-- AI Agents: configurable AI agent definitions (e.g. File Risk Agent).
-- When an agent is configured and is_enabled=true, related UI features appear on respective pages.

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  data_sources TEXT[] DEFAULT '{}',
  provider_config JSONB DEFAULT '{}'::jsonb,
  required_role TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  memory_enabled BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_agents IS 'AI agent configurations. When enabled, related buttons/features appear on respective pages.';

CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX IF NOT EXISTS idx_ai_agents_is_enabled ON public.ai_agents(is_enabled);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agents_select_all"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ai_agents_admin_insert"
  ON public.ai_agents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "ai_agents_admin_update"
  ON public.ai_agents FOR UPDATE
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "ai_agents_admin_delete"
  ON public.ai_agents FOR DELETE
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()));

CREATE TRIGGER ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ai_agent_runs: execution history and telemetry
CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  input TEXT,
  output TEXT,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  latency_ms INTEGER,
  context JSONB DEFAULT '{}'::jsonb,
  token_metrics JSONB,
  provider_used TEXT,
  model_used TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_runs IS 'AI agent execution history and telemetry.';

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent_id ON public.ai_agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_user_id ON public.ai_agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_created_at ON public.ai_agent_runs(created_at DESC);

ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_runs_select_own"
  ON public.ai_agent_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "ai_agent_runs_insert_authenticated"
  ON public.ai_agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ai_agent_runs_updated_at
  BEFORE UPDATE ON public.ai_agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: File Risk Agent (Week 8 MVP deliverable)
INSERT INTO public.ai_agents (
  slug,
  name,
  description,
  category,
  system_prompt,
  data_sources,
  is_enabled,
  memory_enabled,
  metadata
) VALUES (
  'file-risk-agent',
  'File Risk Agent',
  'Monitor timelines, predict delays, flag risk early. Rule-based pipeline analysis — lock expiry, stall detection, condition backlogs, milestone delays.',
  'analysis',
  'You analyze mortgage loan pipeline risk. Focus on lock expiry, stall detection, condition backlogs, and milestone delays.',
  ARRAY['loans', 'loan_risk_scores', 'loan_conditions', 'loan_milestones'],
  false,
  false,
  '{"type": "system"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;
