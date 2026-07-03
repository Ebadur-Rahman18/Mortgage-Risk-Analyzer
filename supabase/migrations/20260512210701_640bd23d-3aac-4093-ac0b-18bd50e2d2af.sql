-- Default AI agents to Google Gemini when provider is unset
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

-- Verify: show rows updated with their provider_config
SELECT slug, name, provider_config FROM public.ai_agents ORDER BY slug;

-- Also verify integration_settings has a google row
SELECT provider_name, is_active, api_key IS NOT NULL as has_key FROM public.integration_settings WHERE provider_name = 'google';

-- Count agents with provider now set
SELECT COUNT(*) as agents_with_provider FROM public.ai_agents WHERE provider_config->>'provider' IS NOT NULL AND provider_config->>'provider' != '';
SELECT COUNT(*) as total_agents FROM public.ai_agents;
SELECT COUNT(*) as agents_with_google FROM public.ai_agents WHERE provider_config->>'provider' = 'google';