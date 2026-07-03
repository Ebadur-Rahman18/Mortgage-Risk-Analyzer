-- Fix: set temperature to 0 on the pipeline-prioritization-agent so urgency scores
-- are fully deterministic for unchanged loan data. Previously 0.2 caused OpenAI to
-- return slightly different engagement/close-probability values on every run,
-- making ranks appear to shuffle even when no loan data had changed.
UPDATE public.ai_agents
SET provider_config = jsonb_set(
  COALESCE(provider_config, '{}'::jsonb),
  '{temperature}',
  '0'::jsonb
)
WHERE slug = 'pipeline-prioritization-agent';
