---
name: ai-routing-safe-edits
description: Safe workflow for AI chat/provider routing edits. Use when changing AIChat, useAIAgents, run-ai-agent, or _shared/ai-utils.
---

# AI Routing Safe Edits

## Apply When

- Editing `src/pages/AIChat.tsx` / `src/pages/AgentChat.tsx`
- Editing `src/hooks/useAIAgents.ts`
- Editing `supabase/functions/run-ai-agent/index.ts`
- Editing `supabase/functions/_shared/ai-utils.ts`

## Required Invariants

- Main chat path stays on `run-ai-agent` (not `ai-chat-assistant`).
- `conversation_id` + `ai_chat_threads` continuity stays intact.
- Memory lifecycle stays intact: `retrieve-agent-memories` then `extract-agent-memories`.
- Providers stay: `openai`, `anthropic`, `google`, `perplexity`.
- Routing stays through `routedChatCompletion(...)`.
- Google NOT_FOUND recovery logic stays.

## Quick Validation

- [ ] No OpenAI-only UI/readiness gates
- [ ] No direct provider API fetch in edge handlers
- [ ] `logAgentRun` still captures AI runs
- [ ] `npm run lint` passes for touched files
