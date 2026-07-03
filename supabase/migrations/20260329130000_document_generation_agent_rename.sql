-- Rename Borrower Communication Agent → Document Generation Agent (slug + labels).
-- Keeps existing ai_agents row; updates slug for useAgentEnabled / edge functions.

UPDATE public.ai_agents
SET
  slug = 'document-generation-agent',
  name = 'Document Generation Agent',
  description = 'Generates loan-related document drafts (borrower updates, condition requests, internal notes) from live loan context. Human approval required before sending.',
  metadata = COALESCE(metadata, '{}'::jsonb) || '{"agent_type": "document-generation", "version": "1.1"}'::jsonb
WHERE slug = 'borrower-communication-agent';
