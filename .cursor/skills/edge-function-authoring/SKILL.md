---
name: edge-function-authoring
description: Build/edit Supabase edge functions with shared auth, CORS, and AI-routing patterns.
---

# Edge Function Authoring

## Apply When

- Creating/editing `supabase/functions/*/index.ts`
- Adding AI calls or admin-only endpoints

## Required Structure

1. CORS preflight first (`handleCors`).
2. JWT auth validation before business logic.
3. `jsonResp` for responses.
4. Use `_shared/` utilities; avoid per-function helper duplication.
5. Use `require-admin` for admin-only handlers.

## AI-Specific Requirements

- Use `routedChatCompletion(...)` (no direct provider API calls).
- Log both success and failure with `logAgentRun(...)`.
- Keep API keys in env/integration settings only.

## Quick Checklist

- [ ] CORS + auth + input validation present
- [ ] Shared helpers used (`_shared/ai-utils.ts`)
- [ ] AI path uses routed dispatch + telemetry
- [ ] `npm run lint` passes for touched files
