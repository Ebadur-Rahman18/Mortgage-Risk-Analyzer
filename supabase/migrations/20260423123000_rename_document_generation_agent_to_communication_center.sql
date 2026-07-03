-- Rename the display name for document-generation-agent in Admin -> Agents.
-- Keep the slug unchanged to avoid breaking existing routes/hooks/feature flags.

update public.ai_agents
set
  name = 'Communication Center Agent',
  updated_at = now()
where slug = 'document-generation-agent';
