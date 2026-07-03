-- Add tools_config column to ai_agents for OpenAI function calling (L3).
-- Stores an array of OpenAI tool definitions (JSON Schema format).
-- Example:
--   [{"type":"function","function":{"name":"search_loans","description":"...","parameters":{...}}}]

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS tools_config JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ai_agents.tools_config IS
  'Array of OpenAI-compatible tool definitions (function calling). '
  'Each element follows the OpenAI tools[] schema: {type, function:{name,description,parameters}}.';
