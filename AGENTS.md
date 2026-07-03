# AGENTS.md

Core instructions for AI coding agents in this repo.

## Project Context

- Production mortgage LOS + AI control tower (not a starter template).
- Frontend: React + TypeScript + Vite + React Query + shadcn/ui.
- Backend: Supabase (Postgres + Edge Functions + RLS).
- High-risk domains: AI routing/memory, loan status transitions, migrations, auth/RLS.

## Fast Start

- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Test: `npm run test`
- Build: `npm run build`

## High-Value Paths

- `src/hooks/` — primary data/business layer; reuse existing hooks first.
- `src/pages/` + `src/components/` — UI/route behavior.
- `supabase/functions/` — server orchestration and integrations.
- `supabase/migrations/` — schema + policy evolution.
- `src/lib/validation.ts` — shared Zod schemas.
- `src/integrations/supabase/types.ts` — generated; do not hand-edit.

## Non-Negotiables

- Keep chat orchestration on `run-ai-agent`.
- Do not silently replace chat flow with `ai-chat-assistant`.
- Preserve `conversation_id` threading and memory lifecycle (`retrieve-agent-memories` + `extract-agent-memories`).
- Preserve multi-provider routing (`openai`, `anthropic`, `google`, `perplexity`) through `_shared/ai-utils.ts`.
- Keep Google NOT_FOUND model auto-recovery logic.
- Never bypass RLS in user-facing flows.
- Never edit old migration files; add new timestamped migrations.

## Implementation Defaults

- Use `@/` imports.
- Use React Query + shared cache keys from `@/lib/cache`.
- Use `logCrud` on data mutations and `toast` from `sonner` for user feedback.
- Use `ProtectedRoute`, `AdminRoute`, and `ModuleRoute` patterns from `src/App.tsx`.

## Security

- Never commit `.env` or secrets.
- Frontend env uses `VITE_SUPABASE_PUBLISHABLE_KEY` (not anon key var name).
- In edge functions: validate JWT before business logic; use service role only for admin/system work.

## Ask Before

- AI architecture/memory/routing changes.
- Auth, RLS, or migration strategy changes.
- New dependencies or broad refactors.
- Loan transition behavior changes.

## Done Criteria

1. Lint/tests pass for touched areas.
2. No unrelated file churn.
3. Summary includes what changed, why, and risks.
