# SJ Innovation Framework - AI Agents Module

> **Comprehensive documentation for the AI Agents Framework module in V1**

---

## 📋 Module Overview

The AI Agents Framework provides a flexible, multi-provider AI system that allows:
- Creating custom AI agents with specific prompts and configurations
- Multi-provider routing (OpenAI, Gemini, Anthropic, Perplexity)
- Semantic search over embedded content
- User-specific personalization
- Chat assistants with context
- Meeting summarization and analysis
- Document generation (SOW, NDA, contracts)

---

## 🎯 Key Features

### **1. AI Agent System**
- Configure custom AI agents with system prompts
- Role-based access control
- Provider fallback configuration
- Execution tracking and approval workflows
- Agent memory for learning

### **2. Semantic Search**
- Vector similarity search using embeddings
- Configurable similarity thresholds
- Entity-type filtering
- Multi-source search (meetings, knowledge base, documents)

### **3. Chat Assistant**
- Context-aware conversations
- Session management
- Chat history persistence
- Multi-turn dialogue support
- Per-agent, multi-thread chat UI (`AgentChat.tsx`) with persistent threads and automatic conversation titles

### **4. Meeting Intelligence**
- Automatic summarization
- Key decision extraction
- Action item identification
- Follow-up topic suggestions

### **5. User Personalization**
- Custom prompts per user
- Personal knowledge library integration
- Context file attachments
- Relevance threshold configuration

---

## 📊 Database Schema

### **Core Tables**

#### `ai_agents`
Agent configurations and definitions.

```sql
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT, -- 'task_management', 'analysis', 'communication', etc.

  -- Configuration
  system_prompt TEXT NOT NULL,
  data_sources TEXT[], -- Array of data source types
  config JSONB DEFAULT '{}'::jsonb,

  -- Multi-provider routing
  provider_config JSONB, -- { primary: {...}, fallbacks: [...] }

  -- Access Control
  required_role TEXT,
  is_enabled BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `system_prompt`: Core instructions for the agent
- `data_sources`: What data the agent can access
- `provider_config`: Routing rules for AI providers
- `required_role`: Minimum role needed to use agent

---

#### `ai_agent_runs`
Execution history and telemetry.

```sql
CREATE TABLE ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id),

  -- Execution
  user_id UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  execution_context JSONB, -- Input parameters
  output JSONB, -- Agent response

  -- Telemetry
  token_metrics JSONB, -- { prompt_tokens, completion_tokens, total_tokens }
  latency_ms INTEGER,
  provider_used TEXT,
  model_used TEXT,
  error_message TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

---

#### `embeddings`
Vector embeddings for semantic search.

```sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  entity_type TEXT NOT NULL, -- 'meeting_transcript', 'knowledge_entry', etc.
  entity_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id), -- For user-specific embeddings

  -- Content
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Vector
  embedding VECTOR(1536), -- OpenAI embedding dimension

  -- Gemini corpus (alternative backend)
  gemini_corpus_id TEXT,
  gemini_document_id TEXT,

  -- Status
  embedding_status TEXT DEFAULT 'completed',

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_user_id ON embeddings(user_id);
```

---

#### `ai_chat_history`
Low-level chat message history (legacy and system-level logging).

```sql
CREATE TABLE ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),

  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_history_session ON ai_chat_history(session_id, created_at);
```

---

#### `ai_chat_threads`
High-level per-user, per-agent chat threads used by the `AgentChat` UI.

```sql
CREATE TABLE ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_slug TEXT,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS (simplified)
-- - Users can read/write/delete their own threads
-- - Admins can optionally delete any thread for troubleshooting/cleanup
```

---

#### `user_agent_personalizations` *(Personal Knowledge System)*
User-specific agent customizations.

```sql
CREATE TABLE user_agent_personalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id),
  agent_id UUID NOT NULL REFERENCES ai_agents(id),

  is_enabled BOOLEAN DEFAULT true,
  additional_prompt TEXT, -- User's custom instructions

  -- Knowledge attachment
  attached_knowledge_files UUID[], -- Array of file IDs
  use_all_knowledge BOOLEAN DEFAULT false,

  -- Context preferences
  max_context_files INTEGER DEFAULT 5,
  relevance_threshold NUMERIC DEFAULT 0.7,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, agent_id)
);
```

---

## 🔧 Edge Functions

### **1. `ai-chat-assistant`**

**Purpose:** General-purpose chat assistant with context awareness.

**Endpoint:** `POST /functions/v1/ai-chat-assistant`

**Request:**
```typescript
{
  message: string;
  session_id: string;
  user_id: string;
  context_type?: 'project' | 'deal' | 'contact';
  context_id?: string;
  include_history?: boolean;
}
```

**Response:**
```typescript
{
  response: string;
  context_used: boolean;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

**Usage Example:**
```typescript
const { data } = await supabase.functions.invoke('ai-chat-assistant', {
  body: {
    message: "What are my overdue tasks?",
    session_id: `session-${userId}`,
    user_id: userId,
    context_type: 'project',
    context_id: projectId
  }
});
```

---

### **2. `semantic-search`**

**Purpose:** Vector similarity search across embeddings.

**Endpoint:** `POST /functions/v1/semantic-search`

**Request:**
```typescript
{
  query: string;
  match_threshold?: number; // 0.0-1.0, default 0.7
  match_count?: number; // Max results, default 10
  entity_type?: string; // Filter by type
  user_id?: string; // Search user-specific embeddings
}
```

**Response:**
```typescript
{
  results: Array<{
    id: string;
    content: string;
    similarity: number;
    entity_type: string;
    entity_id: string;
    metadata: Record<string, any>;
  }>;
}
```

**Usage Example:**
```typescript
const { data } = await supabase.functions.invoke('semantic-search', {
  body: {
    query: "budget planning discussions",
    match_threshold: 0.7,
    match_count: 10,
    entity_type: "meeting_transcript"
  }
});
```

---

### **3. `generate-meeting-summary`**

**Purpose:** AI-powered meeting summarization.

**Endpoint:** `POST /functions/v1/generate-meeting-summary`

**Request:**
```typescript
{
  file_id: string; // zoom_files.id
}
```

**Response:**
```typescript
{
  executive_summary: string;
  key_decisions: string[];
  action_items: string[];
  follow_up_topics: string[];
}
```

---

### **4. `run-ai-agent`**

**Purpose:** Execute configured AI agent with personalization.

**Endpoint:** `POST /functions/v1/run-ai-agent`

**Request:**
```typescript
{
  agent_id: string;
  agent_slug?: string; // Alternative to agent_id
  execution_context: Record<string, any>; // Agent-specific input
  user_id: string;
}
```

**Response:**
```typescript
{
  run_id: string;
  status: 'completed' | 'failed';
  output: any; // Agent-specific output format
  token_usage: TokenMetrics;
  latency_ms: number;
}
```

---

### **5. `generate-embeddings`**

**Purpose:** Generate vector embeddings for content.

**Endpoint:** `POST /functions/v1/generate-embeddings`

**Request:**
```typescript
{
  entity_type: string;
  entity_id: string;
  content: string;
  metadata?: Record<string, any>;
  user_id?: string; // For user-specific embeddings
  chunk_size?: number; // Default 800
}
```

**Response:**
```typescript
{
  success: boolean;
  embeddings_created: number;
  chunks_processed: number;
}
```

---

## 🪝 React Hooks

### **useSemanticSearch**

Search across embedded content.

```typescript
import { useSemanticSearch } from '@/hooks/useAI';

const { search, results, isLoading } = useSemanticSearch();

// Perform search
await search("find budget discussions", {
  similarity_threshold: 0.7,
  limit: 10,
  entity_type: "meeting_transcript"
});
```

---

### **useAIChatAssistant**

Chat with AI assistant.

```typescript
import { useAIChatAssistant } from '@/hooks/useAI';

const sessionId = `session-${userId}-${projectId}`;
const chat = useAIChatAssistant(sessionId);

// Send message
await chat.sendMessage("What tasks are overdue?", {
  context_type: 'project',
  context_id: projectId
});

// Access history
console.log(chat.history); // Array of { role, content }
```

---

### **useRunAIAgent**

Execute AI agent.

```typescript
import { useRunAIAgent } from '@/hooks/useAIAgents';

const { mutate: runAgent, isLoading } = useRunAIAgent();

runAgent({
  agent_slug: 'email-draft-generator',
  execution_context: {
    contact_name: "John Doe",
    contact_email: "john@example.com",
    // ... agent-specific context
  }
});
```

---

### **useAgentPersonalization**

Manage user-specific agent customizations.

```typescript
import { useAgentPersonalization } from '@/hooks/useAgentPersonalization';

const { data: personalization } = useAgentPersonalization(agentId);

// Check if enabled
if (personalization?.is_enabled) {
  console.log('Custom prompt:', personalization.additional_prompt);
  console.log('Attached files:', personalization.attached_knowledge_files);
}
```

---

## 🎨 UI Components

### **AI Chat Interface**

**Location:** `/src/components/ai/AIChatInterface.tsx`

**Props:**
```typescript
interface AIChatInterfaceProps {
  sessionId: string;
  context?: {
    type: 'project' | 'deal' | 'contact';
    id: string;
  };
}
```

**Features:**
- Message input with markdown support
- Chat history display
- Typing indicators
- Context awareness
- Clear history action

---

### **Semantic Search Component**

**Location:** `/src/components/ai/SemanticSearch.tsx`

**Features:**
- Search input with debouncing
- Similarity threshold slider
- Entity type filter
- Results list with similarity scores
- Click to view full content

---

### **Agent Personalization Modal**

**Location:** `/src/components/ai/AgentPersonalizationModal.tsx`

**Features:**
- Enable/disable toggle
- Additional prompt textarea
- Knowledge file selector
- Relevance threshold slider
- Max context files input

---

## 📈 Best Practices

### **1. Semantic Search**

**Similarity Thresholds:**
| Threshold | Use Case |
|-----------|----------|
| 0.9-0.95 | Exact matches only |
| 0.8-0.9 | High relevance |
| **0.7-0.8** | **Recommended balance** |
| 0.6-0.7 | Broad search |
| 0.5-0.6 | Exploratory |

**Tips:**
- ✅ Use similarity threshold 0.7-0.8 for most cases
- ✅ Filter by entity type when possible
- ✅ Limit results to 10-50 for performance
- ❌ Don't use threshold above 0.95 (too strict)
- ❌ Don't fetch more than 50 results at once

---

### **2. Chat Assistant**

**Best Practices:**
- ✅ Use deterministic session IDs: `session-${userId}-${contextId}`
- ✅ Provide context for better answers
- ✅ Limit history to 10-15 messages
- ❌ Don't start new session for every message
- ❌ Don't send PII in messages

---

### **3. AI Agents**

**Configuration:**
- ✅ Write clear, specific system prompts
- ✅ Use agent memory for learning
- ✅ Implement approval workflow for critical tasks
- ✅ Monitor execution costs
- ❌ Don't run agents without user context
- ❌ Don't skip error handling

---

### **4. Embeddings**

**Generation:**
- ✅ Enrich with metadata for better filtering
- ✅ Use consistent chunk sizes (800-1000 chars)
- ✅ Include context (project names, dates)
- ❌ Don't regenerate existing embeddings
- ❌ Don't skip rate limiting delays

---

## 💰 Cost Management

### **Token Usage Monitoring**

```sql
-- Monthly token usage
SELECT
  DATE_TRUNC('month', created_at) as month,
  SUM((token_metrics->>'total_tokens')::int) as total_tokens,
  COUNT(*) as total_requests
FROM ai_agent_runs
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY month
ORDER BY month DESC;
```

### **Model Selection for Cost Optimization**

| Task | Model | Cost | Speed |
|------|-------|------|-------|
| Chat | GPT-4 | $$ | Medium |
| Summaries | GPT-4o-mini | $ | Fast |
| Analysis | GPT-4 | $$ | Medium |
| Embeddings | text-embedding-3-small | $ | Fast |

**Pricing (2024):**
- **GPT-4**: $30/1M input, $60/1M output
- **GPT-4o-mini**: $0.15/1M input, $0.60/1M output
- **text-embedding-3-small**: $0.02/1M tokens

---

## 🔒 Security

### **RLS Policies**

```sql
-- Users can view own embeddings
CREATE POLICY "Users can view own embeddings"
  ON embeddings FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can view own agent personalizations
CREATE POLICY "Users can view own personalizations"
  ON user_agent_personalizations FOR SELECT
  USING (auth.uid() = user_id);
```

### **Data Privacy**

- ✅ User-specific embeddings isolated by `user_id`
- ✅ Chat history scoped to sessions
- ✅ Personal knowledge files private by default
- ✅ Agent runs logged with user ID for audit

---

## 🚀 Quick Start

### **1. Set Up Environment Variables**

```bash
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

### **2. Create Your First Agent**

```sql
INSERT INTO ai_agents (name, slug, description, system_prompt, is_enabled)
VALUES (
  'Task Summarizer',
  'task-summarizer',
  'Summarize tasks for a project',
  'You are a helpful assistant that summarizes project tasks concisely.',
  true
);
```

### **3. Run the Agent**

```typescript
const { data } = await supabase.functions.invoke('run-ai-agent', {
  body: {
    agent_slug: 'task-summarizer',
    execution_context: {
      project_id: 'uuid-here'
    }
  }
});
```

### **4. Test Semantic Search**

```typescript
const { data } = await supabase.functions.invoke('semantic-search', {
  body: {
    query: "project risks",
    match_threshold: 0.7,
    match_count: 5
  }
});
```

---

## 📚 Additional Resources

- [AI_FEATURES_DOCUMENTATION.md](../AI_FEATURES_DOCUMENTATION.md) - Full feature documentation
- [AI_FEATURES_QUICK_REFERENCE.md](../AI_FEATURES_QUICK_REFERENCE.md) - Quick reference
- [AI-AGENT-EXECUTION-ARCHITECTURE.md](../AI-AGENT-EXECUTION-ARCHITECTURE.md) - Architecture deep dive
- [agent-builder-ui-guide.md](../agent-builder-ui-guide.md) - Building custom agents

---

## 🐛 Troubleshooting

### **Semantic Search Returns No Results**

**Solutions:**
1. Lower similarity threshold to 0.5-0.6
2. Check if embeddings exist: `SELECT COUNT(*) FROM embeddings;`
3. Verify embedding format (should be 1536 dimensions)

### **Chat Assistant Not Loading History**

**Solutions:**
1. Use consistent session IDs
2. Check history exists: `SELECT * FROM ai_chat_history WHERE session_id = '...'`
3. Force include history in request

### **Agent Execution Fails**

**Solutions:**
1. Check error message in `ai_agent_runs` table
2. Verify agent is enabled
3. Ensure OPENAI_API_KEY is set in Edge Function secrets

---

**Last Updated:** 2025-12-25
**Version:** 1.0.0
**Module:** AI Agents Framework
