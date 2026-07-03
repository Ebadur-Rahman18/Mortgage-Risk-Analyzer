-- Role Matrix: enable pipeline_views + agents modules, assign required_role to agents
-- Safe to re-run: uses ON CONFLICT DO UPDATE / WHERE guards throughout.

-- =========================================================================
-- 1. Enable pipeline_views and agents modules
-- =========================================================================
INSERT INTO public.module_settings (slug, name, description, enabled, display_order)
VALUES
  ('pipeline_views', 'Pipeline Views', 'HubSpot / Encompass pipeline views', true, 100),
  ('agents',         'AI Agents',      'Agent catalog for all roles',         true, 105)
ON CONFLICT (slug) DO UPDATE
  SET enabled      = EXCLUDED.enabled,
      name         = EXCLUDED.name,
      description  = EXCLUDED.description,
      display_order = EXCLUDED.display_order,
      updated_at   = now();

-- =========================================================================
-- 2. Also enable tasks + knowledge so loan_officer sidebar items work
-- =========================================================================
INSERT INTO public.module_settings (slug, name, description, enabled, display_order)
VALUES
  ('tasks',     'Tasks',          'Task management',          true, 40),
  ('knowledge', 'Knowledge Base', 'Knowledge base entries',   true, 50)
ON CONFLICT (slug) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      updated_at = now();

-- =========================================================================
-- 3. Assign required_role on ai_agents based on the role allowlists defined
--    in src/lib/agentRoles.ts (AGENT_ALLOWED_ROLES_BY_SLUG).
--
--    Mapping logic:
--      - admin/moderator/branch_manager only  → 'admin'
--      - loan_officer and above               → 'loan_officer'
--      - null (all authenticated users)       → NULL (leave unchanged)
-- =========================================================================

-- Admin-only agents (portfolio summary, compliance, branch coach, manager insight)
UPDATE public.ai_agents
SET    required_role = 'admin',
       updated_at    = now()
WHERE  slug IN (
  'portfolio-summary-agent',
  'compliance-screening-agent',
  'branch-performance-coach-agent',
  'manager-insight-agent'
)
AND (required_role IS NULL OR required_role <> 'admin');

-- Loan-officer-and-above agents
UPDATE public.ai_agents
SET    required_role = 'loan_officer',
       updated_at    = now()
WHERE  slug IN (
  'loan-coaching-agent',
  'underwriter-precheck-agent',
  'pipeline-prioritization-agent',
  'file-risk-agent',
  'rate-alert-intelligence-agent',
  'daily-action-agent',
  'borrower-communication-agent'
)
AND (required_role IS NULL OR required_role NOT IN ('loan_officer', 'admin'));

-- All-user agents: ensure required_role stays NULL
UPDATE public.ai_agents
SET    required_role = NULL,
       updated_at    = now()
WHERE  slug IN (
  'ai-chat-assistant',
  'action-items-agent',
  'document-generation-agent',
  'email-intelligence-agent'
)
AND required_role IS NOT NULL;
