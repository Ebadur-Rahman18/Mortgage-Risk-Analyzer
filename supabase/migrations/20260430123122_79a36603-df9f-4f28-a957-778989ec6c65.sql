-- Role Matrix: enable pipeline_views + agents modules, assign required_role to agents
-- Guarded: ai_agents block only runs if the table exists.

INSERT INTO public.module_settings (slug, name, description, enabled, display_order)
VALUES
  ('pipeline_views', 'Pipeline Views', 'HubSpot / Encompass pipeline views', true, 100),
  ('agents',         'AI Agents',      'Agent catalog for all roles',         true, 105)
ON CONFLICT (slug) DO UPDATE
  SET enabled       = EXCLUDED.enabled,
      name          = EXCLUDED.name,
      description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order,
      updated_at    = now();

INSERT INTO public.module_settings (slug, name, description, enabled, display_order)
VALUES
  ('tasks',     'Tasks',          'Task management',          true, 40),
  ('knowledge', 'Knowledge Base', 'Knowledge base entries',   true, 50)
ON CONFLICT (slug) DO UPDATE
  SET enabled    = EXCLUDED.enabled,
      updated_at = now();

DO $$
BEGIN
  IF to_regclass('public.ai_agents') IS NOT NULL THEN
    UPDATE public.ai_agents
    SET    required_role = 'admin', updated_at = now()
    WHERE  slug IN ('portfolio-summary-agent','compliance-screening-agent',
                    'branch-performance-coach-agent','manager-insight-agent')
    AND   (required_role IS NULL OR required_role <> 'admin');

    UPDATE public.ai_agents
    SET    required_role = 'loan_officer', updated_at = now()
    WHERE  slug IN ('loan-coaching-agent','underwriter-precheck-agent',
                    'pipeline-prioritization-agent','file-risk-agent',
                    'rate-alert-intelligence-agent','daily-action-agent',
                    'borrower-communication-agent')
    AND   (required_role IS NULL OR required_role NOT IN ('loan_officer','admin'));

    UPDATE public.ai_agents
    SET    required_role = NULL, updated_at = now()
    WHERE  slug IN ('ai-chat-assistant','action-items-agent',
                    'document-generation-agent','email-intelligence-agent')
    AND    required_role IS NOT NULL;
  END IF;
END $$;