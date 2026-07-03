-- Create ai_agents table (compatible with existing helpers)
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

CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX IF NOT EXISTS idx_ai_agents_is_enabled ON public.ai_agents(is_enabled);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_agents_select_all ON public.ai_agents;
CREATE POLICY ai_agents_select_all ON public.ai_agents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ai_agents_admin_write ON public.ai_agents;
CREATE POLICY ai_agents_admin_write ON public.ai_agents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS ai_agents_set_updated_at ON public.ai_agents;
CREATE TRIGGER ai_agents_set_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed all known agent slugs (disabled by default; role assignment needs the row to exist)
INSERT INTO public.ai_agents (slug, name, description, category, is_enabled, metadata) VALUES
  ('portfolio-summary-agent','Portfolio Summary Agent','Admin portfolio summary','analysis',false,'{"type":"system"}'::jsonb),
  ('compliance-screening-agent','Compliance Screening Agent','Compliance checks','compliance',false,'{"type":"system"}'::jsonb),
  ('branch-performance-coach-agent','Branch Performance Coach','Branch coaching','coaching',false,'{"type":"system"}'::jsonb),
  ('manager-insight-agent','Manager Insight Agent','Manager insights','analysis',false,'{"type":"system"}'::jsonb),
  ('loan-coaching-agent','Loan Coaching Agent','Coaching for LOs','coaching',false,'{"type":"system"}'::jsonb),
  ('underwriter-precheck-agent','Underwriter Precheck Agent','Precheck UW','underwriting',false,'{"type":"system"}'::jsonb),
  ('pipeline-prioritization-agent','Pipeline Prioritization Agent','Prioritize pipeline','analysis',false,'{"type":"system"}'::jsonb),
  ('file-risk-agent','File Risk Agent','Risk monitoring','analysis',false,'{"type":"system"}'::jsonb),
  ('rate-alert-intelligence-agent','Rate Alert Intelligence Agent','Rate alerts','analysis',false,'{"type":"system"}'::jsonb),
  ('daily-action-agent','Daily Action Agent','Daily actions','task_management',false,'{"type":"system"}'::jsonb),
  ('borrower-communication-agent','Borrower Communication Agent','Borrower comms','communication',false,'{"type":"system"}'::jsonb),
  ('ai-chat-assistant','AI Chat Assistant','General chat','chat',true,'{"type":"system"}'::jsonb),
  ('action-items-agent','Action Items Agent','Action items','task_management',true,'{"type":"system"}'::jsonb),
  ('document-generation-agent','Document Generation Agent','Doc gen','document',false,'{"type":"system"}'::jsonb),
  ('email-intelligence-agent','Email Intelligence Agent','Email intel','communication',false,'{"type":"system"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Now assign required_role by slug
UPDATE public.ai_agents
SET required_role = 'admin', updated_at = now()
WHERE slug IN ('portfolio-summary-agent','compliance-screening-agent',
               'branch-performance-coach-agent','manager-insight-agent');

UPDATE public.ai_agents
SET required_role = 'loan_officer', updated_at = now()
WHERE slug IN ('loan-coaching-agent','underwriter-precheck-agent',
               'pipeline-prioritization-agent','file-risk-agent',
               'rate-alert-intelligence-agent','daily-action-agent',
               'borrower-communication-agent');

UPDATE public.ai_agents
SET required_role = NULL, updated_at = now()
WHERE slug IN ('ai-chat-assistant','action-items-agent',
               'document-generation-agent','email-intelligence-agent');