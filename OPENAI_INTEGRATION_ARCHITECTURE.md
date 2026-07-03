# OpenAI Integration - System Architecture

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN PANEL UI                          │
│                    /admin/integrations                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │         OpenAI Integration Card                       │    │
│  │                                                       │    │
│  │  [Logo] OpenAI              [Valid ✓] [Toggle ON]   │    │
│  │                                                       │    │
│  │  API Key: sk-...xyz                                  │    │
│  │  [Update] [Delete] [Test Connection]                 │    │
│  │                                                       │    │
│  │  Last validated: 2 hours ago                         │    │
│  └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ React Query Hooks
                            │ (useIntegrationSetting)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE CLIENT                              │
│                  (Frontend Layer)                               │
│                                                                 │
│  • Authentication (JWT token)                                  │
│  • Row Level Security checks                                   │
│  • Type-safe database queries                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/GraphQL
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   POSTGRESQL DATABASE                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐         │
│  │     integration_settings TABLE                    │         │
│  │                                                   │         │
│  │  id              UUID PRIMARY KEY                │         │
│  │  provider_name   TEXT UNIQUE (openai)            │         │
│  │  api_key         TEXT (encrypted: sk-proj-...)   │         │
│  │  api_key_masked  TEXT (masked: sk-...xyz)        │         │
│  │  is_active       BOOLEAN (true/false)            │         │
│  │  validation_status TEXT (valid/invalid/...)      │         │
│  │  config          JSONB                            │         │
│  │  created_at      TIMESTAMPTZ                     │         │
│  │  updated_at      TIMESTAMPTZ                     │         │
│  │                                                   │         │
│  │  🔒 RLS: Admin users only                        │         │
│  └──────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Service Role Access
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                               │
│                  (Supabase Functions)                           │
│                                                                 │
│  ┌────────────────────────────────────────────────┐           │
│  │  validate-api-key                               │           │
│  │  • Tests API key with provider                  │           │
│  │  • Returns valid/invalid status                 │           │
│  └────────────────────────────────────────────────┘           │
│                                                                 │
│  ┌────────────────────────────────────────────────┐           │
│  │  _shared/integration-utils.ts                   │           │
│  │  • getOpenAIApiKey()                            │           │
│  │  • getAnthropicApiKey()                         │           │
│  │  • Fallback to env vars                         │           │
│  └────────────────────────────────────────────────┘           │
│                                                                 │
│  ┌────────────────────────────────────────────────┐           │
│  │  ai-chat-assistant (example)                    │           │
│  │  • Calls getOpenAIApiKey()                      │           │
│  │  • Uses key for AI operations                   │           │
│  └────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS API Calls
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OPENAI API                                 │
│                  api.openai.com                                 │
│                                                                 │
│  • /v1/models - List models                                    │
│  • /v1/chat/completions - Chat                                 │
│  • /v1/embeddings - Embeddings                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Diagrams

### 1. Admin Configures API Key

```
┌──────┐  1. Enter API Key   ┌──────────────┐  2. Save to DB    ┌──────────┐
│Admin │ ──────────────────> │ Integration  │ ───────────────> │ Postgres │
│  UI  │                     │    Hook      │                  │ Database │
└──────┘                     └──────────────┘                  └──────────┘
   │                                │                                │
   │ 5. Update UI                   │ 3. Call Validate Function      │
   │ <──────────────────────────────┤                                │
   │                                │                                │
   │                                │ 4. Get API Key                 │
   │                                ├───────────────────────────────>│
   │                                │ <───────────────────────────────┤
   │                                │                                │
   │                                ▼                                │
   │                        ┌───────────────┐                       │
   │                        │  OpenAI API   │                       │
   │                        │  Validation   │                       │
   │                        └───────────────┘                       │
   │                                │                                │
   └────────────────────────────────┘                                │
                                                                     │
                          6. Update validation status ──────────────┘
```

### 2. Edge Function Uses API Key

```
┌──────────┐  1. AI Request    ┌────────────────┐  2. Get API Key  ┌──────────┐
│   User   │ ────────────────> │ Edge Function  │ ──────────────> │ Postgres │
│  Action  │                   │ (AI Chat)      │                 │ Database │
└──────────┘                   └────────────────┘                 └──────────┘
                                       │                                │
                                       │ <───────────────────────────────┤
                                       │ 3. Return api_key               │
                                       │                                │
                                       │ 4. Call OpenAI                 │
                                       ▼                                │
                               ┌───────────────┐                       │
                               │  OpenAI API   │                       │
                               └───────────────┘                       │
                                       │                                │
                                       │ 5. Return AI response           │
                                       ▼                                │
┌──────────┐  6. Show Response ┌────────────────┐                     │
│   User   │ <──────────────── │ Edge Function  │                     │
│    UI    │                   │  (AI Chat)     │                     │
└──────────┘                   └────────────────┘                     │
```

### 3. Fallback Mechanism

```
Edge Function needs API key
        │
        ▼
┌───────────────────────┐
│ Check Database        │
│ integration_settings  │
└───────────────────────┘
        │
        ├─> Found & Active? ──YES──> Use Database Key ──> ✅ Success
        │
        └─> Not Found? ──OR── Inactive?
                    │
                    ▼
            ┌───────────────────────┐
            │ Check Environment Var │
            │ OPENAI_API_KEY        │
            └───────────────────────┘
                    │
                    ├─> Found? ──YES──> Use Env Key ──> ✅ Success
                    │
                    └─> Not Found? ──> ❌ Error: API key not configured
```

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                              │
└─────────────────────────────────────────────────────────────────┘

Layer 1: UI Access Control
┌─────────────────────────────────────────────────────────────────┐
│  • Only admin users can access /admin/integrations              │
│  • <AdminRoute> wrapper on component                            │
│  • Redirects non-admins to login                                │
└─────────────────────────────────────────────────────────────────┘
                            ▼
Layer 2: Authentication
┌─────────────────────────────────────────────────────────────────┐
│  • JWT token verification                                       │
│  • Supabase Auth checks token validity                          │
│  • Token passed in Authorization header                         │
└─────────────────────────────────────────────────────────────────┘
                            ▼
Layer 3: Row Level Security (RLS)
┌─────────────────────────────────────────────────────────────────┐
│  • Database-level security policies                             │
│  • Only users with role='admin' can access                      │
│  • Enforced at PostgreSQL level                                 │
│  • Cannot be bypassed from frontend                             │
└─────────────────────────────────────────────────────────────────┘
                            ▼
Layer 4: Data Encryption
┌─────────────────────────────────────────────────────────────────┐
│  • API keys stored encrypted in database                        │
│  • PostgreSQL encryption at rest                                │
│  • Masked display in UI (sk-...xyz)                             │
└─────────────────────────────────────────────────────────────────┘
                            ▼
Layer 5: Service Role Protection
┌─────────────────────────────────────────────────────────────────┐
│  • Only edge functions with service key can read full key       │
│  • Service key stored securely in Supabase                      │
│  • Never exposed to frontend                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Component Architecture

```
src/
├── components/
│   └── admin/
│       └── OpenAIIntegrationCard.tsx
│           • UI component for managing API key
│           • Uses hooks for data operations
│           • Handles validation, save, delete
│
├── hooks/
│   └── useIntegrationSettings.ts
│           • React Query hooks
│           • useIntegrationSetting(provider)
│           • useSaveIntegrationSetting()
│           • useValidateIntegrationKey()
│           • useDeleteIntegrationSetting()
│           • useToggleIntegrationStatus()
│
├── pages/
│   └── admin/
│       └── Integrations.tsx
│           • Main integrations page
│           • Tabs for different categories
│           • Includes OpenAIIntegrationCard
│
└── integrations/
    └── supabase/
        ├── client.ts - Supabase client setup
        └── types.ts - TypeScript interfaces
            • integration_settings table types
            • Type-safe database operations
```

## 🔌 Edge Functions Architecture

```
supabase/functions/
├── validate-api-key/
│   └── index.ts
│       • Validates API keys with providers
│       • validateOpenAI(apiKey)
│       • validateAnthropic(apiKey)
│       • CORS handling
│       • Error handling
│
├── _shared/
│   └── integration-utils.ts
│       • getProviderApiKey(provider)
│       • getOpenAIApiKey() - with fallback
│       • getAnthropicApiKey() - with fallback
│       • isProviderActive(provider)
│       • Shared by all AI edge functions
│
└── ai-chat-assistant/ (example)
    └── index.ts
        • Imports getOpenAIApiKey()
        • Uses stored key for AI operations
        • Falls back to env vars if needed
```

## 🗄️ Database Schema Relationships

```
┌─────────────────────┐
│     auth.users      │
│  (Supabase Auth)    │
│                     │
│  • id (UUID)        │
│  • email            │
└─────────────────────┘
          │
          │ Foreign Key
          ▼
┌─────────────────────┐         ┌──────────────────────────┐
│    user_roles       │         │  integration_settings    │
│                     │         │                          │
│  • user_id    ──────┤         │  • id (UUID PK)          │
│  • role_name        │         │  • provider_name UNIQUE  │
│    (admin)          │         │  • api_key (encrypted)   │
└─────────────────────┘         │  • api_key_masked        │
          │                     │  • is_active             │
          │ RLS Policy          │  • validation_status     │
          │ Checks              │  • config (JSONB)        │
          └─────────────────────> • created_by FK          │
                                │  • updated_by FK          │
                                └──────────────────────────┘
```

## 🎯 API Key Lifecycle

```
┌────────────┐
│   CREATE   │  Admin adds new API key
└────────────┘
      │
      ▼
┌────────────┐
│   SAVE     │  Store encrypted in database
└────────────┘
      │
      ▼
┌────────────┐
│  VALIDATE  │  Test with provider (optional)
└────────────┘
      │
      ▼
┌────────────┐
│   ENABLE   │  Toggle is_active = true
└────────────┘
      │
      ▼
┌────────────┐
│    USE     │  Edge functions retrieve key
└────────────┘
      │
      ├─────> UPDATE ──> Admin changes key
      │
      ├─────> DISABLE ──> Toggle off temporarily
      │
      └─────> DELETE ──> Remove integration
```

## 🔄 Request Flow Examples

### Example 1: User sends AI chat message

```
1. User types message in UI (/ai/chat)
2. Frontend calls edge function: ai-chat-assistant
3. Edge function calls: getOpenAIApiKey(supabase_url, service_key)
4. Utility checks integration_settings table
5. If found & active: returns api_key
6. If not found: checks OPENAI_API_KEY env var
7. Edge function calls OpenAI API with key
8. OpenAI returns AI response
9. Edge function returns response to frontend
10. UI displays AI message
```

### Example 2: Admin tests API key

```
1. Admin enters API key in UI
2. Admin clicks "Test Connection"
3. Frontend calls: useValidateIntegrationKey()
4. Hook calls edge function: validate-api-key
5. Edge function calls OpenAI /v1/models endpoint
6. OpenAI returns success (200) or error (401)
7. Edge function updates validation_status in database
8. Frontend updates UI with status badge
```

## 📈 Scalability Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│  Current Architecture: Single Organization                      │
│  • One integration_settings table                               │
│  • Global API keys                                              │
│  • All users share same keys                                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Future: Multi-tenant
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Multi-Organization Support                                     │
│  • Add organization_id column                                   │
│  • Separate keys per organization                               │
│  • RLS policies filter by org                                   │
│  • Organization-specific usage tracking                         │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Extensibility Points

### Adding a New Provider (e.g., Anthropic)

```
1. Database
   • No changes needed (supports any provider_name)

2. UI Component
   • Create: AnthropicIntegrationCard.tsx
   • Copy/modify from OpenAIIntegrationCard.tsx
   • Update icon, name, links

3. Validation Function
   • Add validateAnthropic() to validate-api-key/index.ts
   • Add case to switch statement

4. Shared Utilities
   • Already has getAnthropicApiKey() helper
   • Ready to use in edge functions

5. Integrations Page
   • Import and add <AnthropicIntegrationCard />
   • Done! 🎉
```

---

**Architecture Version:** 1.0.0  
**Last Updated:** 2026-02-10  
**Status:** Production Ready ✅
