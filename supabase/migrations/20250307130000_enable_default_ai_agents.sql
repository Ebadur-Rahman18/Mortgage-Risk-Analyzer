-- Enable core AI agents by default (Daily Action + File Risk).
-- This is safe to re-run; it only affects these two slugs.

UPDATE public.ai_agents
SET is_enabled = true
WHERE slug IN ('daily-action-agent', 'file-risk-agent');

