-- Default AI agents to Google Gemini when provider is unset (pairs with Admin Integrations `google` + Lovable GOOGLE_AI_API_KEY).
UPDATE public.ai_agents
SET provider_config = COALESCE(provider_config, '{}'::jsonb)
  || jsonb_build_object('provider', 'google')
  || CASE
       WHEN provider_config ? 'model'
         AND NULLIF(trim(provider_config->>'model'), '') IS NOT NULL
       THEN '{}'::jsonb
       ELSE jsonb_build_object('model', 'gemini-2.0-flash')
     END
WHERE COALESCE(trim(provider_config->>'provider'), '') = '';
