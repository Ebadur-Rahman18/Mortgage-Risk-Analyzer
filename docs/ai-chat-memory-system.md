# AI Chat Memory System

This document explains the full memory flow implemented in the AI Chat feature (`AIChat.tsx`). The system is designed to give AI agents persistent, personalized memory per user — so the agent can recall facts, preferences, and context from past conversations.

---

## Architecture Overview

```
User sends message
      │
      ▼
useSendMessage() hook
      │
      ├── 1. Insert user message → agent_messages
      │
      └── 2. Invoke Edge Function: agent-conversation-chat
                        │
                        ├── Fetch agent config (checks memory_enabled flag)
                        ├── Fetch user personalization
                        │
                        ├── [if memory_enabled] retrieve-agent-memories ──► agent_memories table
                        │                                                     (vector search + recent)
                        ├── [if include_rag] semantic-search ──► embeddings / knowledge_entries
                        │
                        ├── Fetch conversation history (agent_messages)
                        │
                        ├── Build system prompt:
                        │     system_prompt + personalization + rag_context + memory_context
                        │
                        ├── Call AI provider (OpenAI / etc.)
                        │
                        └── [if memory_enabled] extract-agent-memories (fire-and-forget)
                                        │
                                        └── AI extracts facts/preferences/summaries
                                            → generate embedding for each
                                            → store in agent_memories (short_term)
```

---

## Step-by-Step Flow

### Step 1 — Agent has `memory_enabled = true`

The `ai_agents` table has a `memory_enabled` boolean column. When true, memory features activate. The UI shows a "Memory" badge on those agents.

### Step 2 — User sends a message

`useSendMessage()` in `src/hooks/useAgentConversations.ts`:

1. Inserts the user message row into `agent_messages` immediately.
2. Calls the `agent-conversation-chat` Edge Function with:
   - `conversation_id`
   - `agent_id`
   - `message` (the user's text)
   - `user_id`
   - optional `model_id`

### Step 3 — Edge Function: `agent-conversation-chat`

This is the core orchestration function at `supabase/functions/agent-conversation-chat/index.ts`.

**It does the following in sequence:**

#### 3a. Fetch agent config
Loads the full agent row from `ai_agents`, including `memory_enabled`, `system_prompt`, and `provider_config`.

#### 3b. Fetch user personalization
Queries `user_agent_personalizations` for the user/agent pair. If found, an `additional_prompt` is appended to the system prompt. Also controls RAG settings (`relevance_threshold`, `max_context_files`, `use_all_knowledge`).

#### 3c. Retrieve memories (only when `memory_enabled = true`)
Calls the `retrieve-agent-memories` Edge Function (see Step 4 below). Returns up to 5 relevant memories formatted as:

```
RELEVANT CONTEXT FROM PREVIOUS CONVERSATIONS:
[preference] User prefers bullet-point summaries (relevance: 87%)
[fact] User is planning Q3 budget (relevance: 82%)
```

This block is appended to the system prompt.

#### 3d. RAG context (semantic search)
Calls `semantic-search` to find relevant knowledge base entries. Appended to system prompt as `RELEVANT KNOWLEDGE`.

#### 3e. Conversation history
Fetches the last N messages (default 20) from `agent_messages` for the current conversation, filtered to `user` and `assistant` roles only.

#### 3f. Build system prompt
Concatenates all context in this order:
```
agent.system_prompt
+ additional_prompt (personalization)
+ ragContext
+ memoryContext
```

#### 3g. Call AI provider
Passes the full messages array (system + history + current user message) to the AI provider via `chatCompletion()`.

#### 3h. Fire-and-forget: extract memories
After returning the response, the function fires a background request to `extract-agent-memories` — it does NOT wait for this to complete. This keeps response time fast.

### Step 4 — Edge Function: `retrieve-agent-memories`

Located at `supabase/functions/retrieve-agent-memories/index.ts`.

**Two retrieval strategies, combined:**

| Strategy | How | When |
|---|---|---|
| Semantic | Embeds the user's message → vector cosine similarity against `agent_memories.embedding` | When embedding generation succeeds |
| Recent | Direct DB query filtering memories created in the last 7 days | Always (as fallback and supplement) |

**Deduplication and ranking:**
- Semantic matches take priority over recent-only matches
- Sorted by: similarity score → importance_score → created_at (newest first)
- Access stats (`access_count`, `last_accessed_at`) are updated for all returned memories via the `increment_memory_access` RPC

**Returns:** up to N memories (default 5) with content, category, and similarity score.

### Step 5 — Edge Function: `extract-agent-memories`

Located at `supabase/functions/extract-agent-memories/index.ts`.

This runs after every AI response, in the background.

1. Fetches all messages for the current conversation from `agent_messages`
2. Sends the full conversation text to the AI with a memory extraction prompt
3. The AI returns a JSON array of memories with:
   - `memory_type`: `summary` | `fact` | `preference` | `decision` | `pattern`
   - `content`: 1-2 sentence description
   - `relevance_score`: 0.5–1.0

4. For each extracted memory:
   - Generates a vector embedding via `generate-embeddings`
   - Stores in `agent_memories` table with `memory_type = 'short_term'`

---

## Database Schema

### `agent_memories`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `agent_id` | UUID | FK → ai_agents |
| `user_id` | UUID | FK → auth.users (per-user memory) |
| `memory_type` | TEXT | `short_term`, `long_term`, `episodic`, `semantic` |
| `memory_category` | TEXT | `fact`, `preference`, `summary`, `decision`, `pattern` |
| `content` | TEXT | The memory text |
| `summary` | TEXT | First 200 chars of content |
| `embedding` | vector(1536) | For semantic search |
| `source_type` | TEXT | e.g. `conversation` |
| `source_id` | UUID | Conversation ID that produced it |
| `importance_score` | FLOAT | 0.0–1.0, higher = more important |
| `access_count` | INTEGER | How many times this memory was retrieved |
| `last_accessed_at` | TIMESTAMPTZ | Last retrieval time |
| `is_active` | BOOLEAN | Soft-delete flag |
| `consolidated` | BOOLEAN | True when promoted from short_term → long_term |
| `superseded_by` | UUID | Self-referential: replaced by another memory |

### `agent_conversations`

Stores conversation threads. Each conversation belongs to one user + one agent. Messages cascade delete from this table.

Key columns: `title` (auto-generated from first message), `summary`, `message_count`, `last_message_at`, `is_archived`, `is_pinned`.

### `agent_messages`

Individual messages within a conversation.

Key columns: `role` (user/assistant/system/tool), `content`, `model_used`, `tokens_input`, `tokens_output`, `latency_ms`.

---

## Memory Lifecycle

```
Conversation ends
      │
      ▼
extract-agent-memories (background)
      │
      ▼
agent_memories (memory_type = 'short_term')
      │
      ├── If accessed + old enough (7+ days) + importance >= 0.3
      │         ▼
      │   consolidate_short_term_memories()
      │         ▼
      │   memory_type = 'long_term'
      │
      └── If never accessed + old (30+ days) + importance < 0.2
                ▼
          prune_short_term_memories()
                ▼
          is_active = false (soft delete)
```

DB functions available:
- `consolidate_short_term_memories(agent_id, user_id, days_old)` — promotes old short_term → long_term
- `prune_short_term_memories(agent_id, user_id, days_old, importance_threshold)` — soft-deletes stale memories
- `get_relevant_memories(...)` — vector similarity search used by `retrieve-agent-memories`
- `increment_memory_access(memory_ids[])` — updates access stats atomically

---

## Key Design Decisions

**1. Memory is per user + per agent**
Each memory row has both `user_id` and `agent_id`. If the same user talks to two different agents, their memories are completely separate.

**2. Fire-and-forget extraction**
Memory extraction does NOT block the response. The user gets a fast reply, then memories are extracted in the background. This trades consistency for speed — a memory from the current conversation won't be available until the NEXT conversation.

**3. Two-phase retrieval**
Using both semantic search (vector similarity on the query) and recency-based recall handles cases where the embedding model produces low similarity but the context is still recent and relevant.

**4. Short → long term promotion**
New memories are always `short_term`. Only memories that prove useful (accessed at least once) and are old enough get promoted to `long_term`. Low-value short_term memories are pruned.

**5. Memory is injected into the system prompt, not the message history**
The formatted memories are appended to the system prompt, not inserted as fake messages. This keeps the conversation history clean and avoids confusing the model.

---

## Required Infrastructure to Replicate

To implement this system in another project you need:

### Edge Functions
- `agent-conversation-chat` — main chat orchestrator
- `retrieve-agent-memories` — semantic + recent memory lookup
- `extract-agent-memories` — post-conversation memory extraction
- `generate-embeddings` — shared embedding generation

### Database Tables
- `ai_agents` (with `memory_enabled` boolean)
- `agent_conversations`
- `agent_messages`
- `agent_memories` (with `vector(1536)` embedding column)
- `user_agent_personalizations` (optional, for per-user prompts)

### Database Functions (SQL)
- `get_relevant_memories(...)` — vector cosine similarity search
- `increment_memory_access(memory_ids[])` — atomic access count update
- `consolidate_short_term_memories(...)` — short → long term promotion
- `prune_short_term_memories(...)` — stale memory cleanup
- `update_conversation_stats()` trigger — keeps message_count and last_message_at in sync

### Extensions Required
- `pgvector` — for `vector(1536)` column type and cosine similarity (`<=>` operator) and `ivfflat` index

### Frontend
- `useAgentConversations`, `useAgentMessages`, `useSendMessage` hooks (TanStack Query)
- `AgentConversationView` — chat UI component
- `AgentConversationList` — sidebar conversation list

---

## Environment Variables

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY  (or whichever provider is used for embeddings + chat)
```