-- Seed Daily Action Agent into ai_agents (idempotent).
-- This is separate from the original File Risk Agent seed so it can run
-- even if 20250307100000 has already been applied.

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
  'daily-action-agent',
  'Daily Action Agent',
  'Helps loan officers and managers prioritize daily actions across the pipeline: which loans to touch, which conditions to chase, and what risks to address today.',
  'task_management',
  'You are the Daily Action Agent for a mortgage operations team. Your job is to help the user decide what to work on TODAY based on their questions and context. Be concise and action-oriented, propose concrete next steps, and reference loans/borrowers/conditions when that information is provided.',
  ARRAY['loans', 'loan_conditions', 'loan_milestones', 'loan_risk_scores'],
  false,
  true,
  '{"type": "daily"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

