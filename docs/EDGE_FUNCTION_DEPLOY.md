# Edge Function Deployment — MCT Lite

Deploy via Lovable Cloud dashboard **or** locally with the Supabase CLI.

## CLI commands (run from repo root)

```bash
# 1. Bootstrap demo users (run once on a new project)
npx supabase functions deploy seed-demo-users

# 2. Core AI chat engine (must be deployed for AI Chat + Agent Chat to work)
npx supabase functions deploy run-ai-agent

# 3. AI memory lifecycle (required when memory_enabled = true on any agent)
npx supabase functions deploy retrieve-agent-memories
npx supabase functions deploy extract-agent-memories

# 4. HubSpot / Encompass data feed sync (required for Pipeline page)
npx supabase functions deploy sync-data-feed
npx supabase functions deploy validate-api-key

# 5. Knowledge base semantic search
npx supabase functions deploy generate-embeddings
npx supabase functions deploy semantic-search

# 6. Borrower communications (Communication Center)
npx supabase functions deploy send-borrower-email
npx supabase functions deploy auto-draft-milestone-comm

# 7. Gmail integration (Email Intelligence — disabled module by default)
npx supabase functions deploy gmail-oauth-start
npx supabase functions deploy gmail-oauth-callback
npx supabase functions deploy gmail-sync
```

## Required environment variables (set in Supabase dashboard → Edge Functions → Secrets)

| Variable | Used by |
|----------|---------|
| `OPENAI_API_KEY` | run-ai-agent fallback (or set via Admin → Integrations) |
| `SUPABASE_URL` | All functions (auto-injected) |
| `SUPABASE_ANON_KEY` | All functions (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | All functions (auto-injected) |

All other API keys (Google AI, Anthropic, Perplexity, SendGrid, HubSpot, Zoom, LendingPad, DocuSign)
are stored in the `integration_settings` table via **Admin → Integrations** and resolved at runtime.

## After deploying

1. Run the new migration: `npx supabase db push`
2. Call `seed-demo-users` once (via Supabase dashboard → Edge Functions → Invoke) or via:
   ```bash
   npx supabase functions invoke seed-demo-users
   ```
3. Log in as `admin@demo.co / DemoAdmin!2026`, go to **Admin → Integrations**, add your OpenAI key.
4. Go to **Admin → Module Management** and confirm `pipeline_views` and `agents` are enabled.
