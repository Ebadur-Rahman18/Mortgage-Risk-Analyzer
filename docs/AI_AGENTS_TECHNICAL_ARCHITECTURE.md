# AI Agents Technical Architecture

This document describes the current production architecture for AI agents and AI chat in this repository, based on implemented code paths.

## 1) System Overview

The AI system has two primary execution modes:

- **Dispatcher-based agent execution** (memory-aware): `run-ai-agent`
- **Direct assistant completion** (stateless chat API + telemetry): `ai-chat-assistant`

In the current implementation:

- `AgentChat` routes use `run-ai-agent`
- `/ai` ("Default Assistant") UI uses `run-ai-agent` behind the scenes via a hidden runtime agent selection
- Some domain-specific experiences still call dedicated functions (example: `loan-coaching-agent`)

## 2) Core Runtime Components

### Edge Functions

- `supabase/functions/run-ai-agent/index.ts`
  - Central orchestration for AI agents
  - Server-side agent config resolution from `ai_agents`
  - Memory retrieval injection when `memory_enabled = true`
  - Tool-calling loop with built-in/agent-defined tools
  - Conversation persistence to relational tables
  - Fire-and-forget memory extraction

- `supabase/functions/retrieve-agent-memories/index.ts`
  - Fetches relevant memories using:
    - semantic retrieval (`search_agent_memories` RPC + embeddings)
    - recency fallback/supplement (last 7 days)
  - Ranks by similarity -> importance -> recency
  - Increments access stats via `increment_memory_access` RPC

- `supabase/functions/extract-agent-memories/index.ts`
  - Extracts structured memories from recent conversation turns
  - Produces `content`, `importance_score`, `memory_type`
  - Generates embeddings and writes rows to `agent_memories`
  - Sets `expires_at` for short-term memories (24h)

- `supabase/functions/ai-chat-assistant/index.ts`
  - Direct OpenAI chat completion endpoint
  - Supports streaming and non-streaming
  - Logs usage to `ai_agent_runs` for telemetry
  - Does not orchestrate relational memory lifecycle by itself

### Shared Modules

- `supabase/functions/_shared/ai-utils.ts`
  - OpenAI key retrieval, completion utilities, routing helpers, logging helpers

- `supabase/functions/_shared/tool-executor.ts`
  - Built-in tools (`search_loans`, `get_loan_details`, `search_knowledge_base`, `get_pipeline_summary`)
  - Tool resolution/merge with agent `metadata.tools_config`

## 3) Frontend Execution Paths

### A) Agent Chat (`/ai/agents/:agentId/chat`, `/admin/agents/:agentId/chat`)

File: `src/pages/AgentChat.tsx`

Request path:

1. User sends message in UI
2. Frontend invokes `run-ai-agent` with:
   - `agent_slug`, `agent_id`, `input`
   - `conversation_history` (UI thread)
   - `conversation_id` (if continuing)
3. Response returns `output` + `conversation_id`
4. UI updates thread and stores `conversation_id` in `ai_chat_threads.metadata`

### B) AI Chat (`/ai`)

File: `src/pages/AIChat.tsx`

Behavior:

- UI remains a "normal" Default Assistant chat
- Backend execution still uses `run-ai-agent` for memory support
- Runtime hidden agent selection:
  - prefers `customer-support-assistant`
  - then `ai-chat-assistant`
  - then name `Default Assistant`
  - then first candidate
  - memory-enabled set preferred; enabled-only fallback prevents hard failure

Threading:

- UI threads in `ai_chat_threads` use `agent_slug = 'default-assistant-chat'`
- Relational memory thread continuity is maintained via `metadata.conversation_id`

### C) Dedicated Domain Agent Flows

Example: `src/hooks/useLoanCoachingAgent.ts` invokes `loan-coaching-agent` directly.

These paths may implement domain-specific behavior and are not automatically guaranteed to use `run-ai-agent` memory orchestration unless explicitly wired.

## 4) Data Model

## Relational Agent Conversation Tables

Migration: `supabase/migrations/20260408200000_agent_conversations_messages.sql`

- `agent_conversations`
  - `(agent_id, user_id)` conversation threads
  - title, message_count, last_message_at, metadata

- `agent_messages`
  - role-based message rows (`system|user|assistant|tool`)
  - model/latency/token metadata

- `user_agent_personalizations`
  - per-user + per-agent prompt/tone preferences

Triggers:

- `update_conversation_stats` increments counts/timestamps
- `generate_conversation_title` auto-titles on first user message

## Memory Tables and RPC

Migration: `supabase/migrations/20260408210000_agent_memory_system.sql`

- `agent_memories`
  - scoped by `(agent_id, user_id)`
  - fields: `memory_type`, `content`, `embedding`, `importance_score`, `access_count`, `expires_at`, etc.

RPC:

- `search_agent_memories(...)` semantic similarity search using pgvector cosine distance

Migration: `supabase/migrations/20260408260000_increment_memory_access_rpc.sql`

- `increment_memory_access(p_memory_ids uuid[])`
  - atomic `access_count + 1`
  - updates `last_accessed_at`

## Lifecycle Automation

Migration: `supabase/migrations/20260408230000_memory_lifecycle_cron.sql`

- `prune_expired_memories()` every 30 minutes
- `consolidate_short_term_memories()` hourly
  - promotes `short_term -> long_term` when:
    - `access_count >= 3`
    - recent (`< 7 days`)
    - not expired

## 5) End-to-End Memory Flow

When `run-ai-agent` is invoked for a memory-enabled agent:

1. Resolve user and agent config
2. Call `retrieve-agent-memories` with `(agent_id, user_id, input query)`
3. Inject formatted memory block into system prompt
4. Run model completion (+ optional tool loop)
5. Persist messages to relational conversation tables
6. Trigger background `extract-agent-memories`
7. `extract-agent-memories` writes memory rows with dynamic:
   - `memory_type` (`short_term`/`long_term`)
   - `importance_score` (`0.5..1.0`)
   - `expires_at` (24h for short-term, null for long-term)
8. Future retrievals increment `access_count` through RPC

## 6) Security and Access Model

- Edge functions validate JWT (or service role for internal calls)
- DB tables enforce RLS for user isolation
- Service-role internal calls are used where orchestration needs privileged writes

Key rule:

- Memory is isolated by **both** `agent_id` and `user_id`
- If runtime agent changes, prior memory scoped to previous `agent_id` will not be retrieved

## 7) Operational Notes

### Required environment

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (or integration-backed key retrieval)

### Functions that must be deployed together for memory features

- `run-ai-agent`
- `retrieve-agent-memories`
- `extract-agent-memories`

### Migrations required for memory correctness

- `20260408200000_agent_conversations_messages.sql`
- `20260408210000_agent_memory_system.sql`
- `20260408230000_memory_lifecycle_cron.sql`
- `20260408260000_increment_memory_access_rpc.sql`

## 8) Troubleshooting Playbook

If memory recall fails:

1. Confirm chat path uses `run-ai-agent` (not only `ai-chat-assistant`)
2. Confirm selected runtime agent is `is_enabled = true` and `memory_enabled = true`
3. Verify `agent_memories` rows exist for the same `(agent_id, user_id)`
4. Verify `increment_memory_access` exists and access_count increases
5. Check for embedding failures in edge logs (`retrieve-agent-memories`, `extract-agent-memories`)
6. Confirm `conversation_id` continuity is persisted/restored on the UI thread

## 9) Change Safety Guidance

For architectural stability:

- Treat chat execution paths as protected:
  - do not silently swap between `run-ai-agent` and `ai-chat-assistant`
- Prefer additive fixes over structural rewrites
- Preserve backward compatibility for thread/memory records
- Use explicit migrations for schema changes

---

Last updated: aligned to current implementation after memory pipeline stabilization and AI chat runtime-agent hardening.
