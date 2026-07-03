-- Telemetry agent for ai-chat-assistant edge function (required FK on ai_agent_runs.agent_id).
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
  'ai-chat-assistant',
  'AI Chat Assistant',
  'Platform chat completions via OpenAI; rows are created for usage analytics.',
  'chat',
  'You are a helpful assistant.',
  ARRAY[]::text[],
  true,
  false,
  '{"type": "system","telemetry_only": true}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Allow admin analytics page to receive live updates when new usage rows are inserted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_agent_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_runs;
  END IF;
END $$;
