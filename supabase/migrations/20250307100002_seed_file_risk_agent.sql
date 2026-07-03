-- Seed File Risk Agent into ai_agents (idempotent).
-- Run this if the agent does not appear in Admin > AI Agents.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).

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

-- Daily Action Agent (chat-driven assistant for daily pipeline focus)
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
  'assistant',
  'You are the Daily Action Agent for a mortgage operations team. Your job is to help the user decide what to work on TODAY based on their questions and context. Be concise and action-oriented, propose concrete next steps, and reference loans/borrowers/conditions when that information is provided.',
  ARRAY['loans', 'loan_conditions', 'loan_milestones', 'loan_risk_scores'],
  false,
  true,
  '{"type": "daily"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

