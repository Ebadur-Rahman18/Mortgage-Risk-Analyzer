# SJ Innovation Framework - Knowledge Base Module

> **Documentation for the Knowledge Base & Personal Knowledge system in V1**

---

## 📋 Module Overview

The Knowledge Base module provides:
- **Admin Knowledge Base**: Organization-wide knowledge management
- **Personal Knowledge System**: User-specific private knowledge libraries
- **Vector Search**: Semantic search across all knowledge
- **Google Drive Integration**: Sync files from Google Drive
- **Multi-Backend Support**: OpenAI and Gemini for embeddings
- **Content Management**: Categories, tags, and organization

---

## 🎯 Key Features

### **1. Admin Knowledge Base**
- Organization-wide knowledge repository
- Admin-only upload and management
- Category-based organization
- File processing pipeline
- Vector embeddings for search

### **2. Personal Knowledge System**
- Private user libraries
- File upload and Google Drive sync
- RLS-protected data isolation
- AI agent personalization
- Knowledge attachment to agents

### **3. Semantic Search**
- Full-text search
- Vector similarity search
- Cross-user search (admin) or private (user)
- Relevance scoring
- Entity type filtering

### **4. File Processing**
- Automatic embedding generation
- Multiple file format support (PDF, DOCX, TXT, MD)
- Chunk-based indexing
- Status tracking
- Retry logic for failures

---

## 📊 Database Schema

### **Admin/Global Knowledge Tables**

#### `knowledge_entries`
Main knowledge base entries.

```sql
CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  entry_type TEXT, -- 'article', 'guide', 'documentation', etc.

  -- Organization
  category_id UUID REFERENCES knowledge_categories(id),
  tags TEXT[],

  -- Authorship
  author_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'

  -- Search
  search_vector TSVECTOR, -- Full-text search

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_entries_category ON knowledge_entries(category_id);
CREATE INDEX idx_knowledge_entries_status ON knowledge_entries(status);
CREATE INDEX idx_knowledge_entries_search ON knowledge_entries USING GIN(search_vector);
```

---

#### `knowledge_categories`
Categories for organizing knowledge.

```sql
CREATE TABLE knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT UNIQUE NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,

  -- Hierarchy
  parent_id UUID REFERENCES knowledge_categories(id),

  -- Display
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### `knowledge_files`
Admin knowledge files.

```sql
CREATE TABLE knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source_id UUID REFERENCES knowledge_sources(id),

  -- File metadata
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT,
  mime_type TEXT,

  -- External reference (Google Drive)
  external_id TEXT,
  external_url TEXT,

  -- Processing
  is_indexed BOOLEAN DEFAULT false,
  indexed_at TIMESTAMPTZ,
  embedding_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',
  error_message TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### `knowledge_sources`
Knowledge file sources (manual, Google Drive).

```sql
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT CHECK (source_type IN ('manual', 'google_drive', 'supabase_storage')),

  -- Configuration
  config JSONB DEFAULT '{}'::jsonb,

  -- Backend preference
  storage_backend TEXT CHECK (storage_backend IN ('openai', 'gemini', 'hybrid', 'auto')),

  -- Gemini corpus
  gemini_corpus_id TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **Personal Knowledge Tables**

#### `user_knowledge_sources`
User-specific knowledge sources.

```sql
CREATE TABLE user_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT CHECK (source_type IN ('manual', 'google_drive', 'supabase_storage')),

  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  storage_backend TEXT,
  gemini_corpus_id TEXT,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);
```

**RLS:**
```sql
ALTER TABLE user_knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sources"
  ON user_knowledge_sources
  USING (auth.uid() = user_id);
```

---

#### `user_knowledge_files`
User-specific knowledge files.

```sql
CREATE TABLE user_knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES user_knowledge_sources(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT,
  mime_type TEXT,

  external_id TEXT,
  external_url TEXT,

  -- Processing
  is_indexed BOOLEAN DEFAULT false,
  indexed_at TIMESTAMPTZ,
  embedding_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',
  processing_priority INTEGER DEFAULT 5,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, source_id, file_name)
);
```

**RLS:**
```sql
ALTER TABLE user_knowledge_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own files"
  ON user_knowledge_files
  USING (auth.uid() = user_id);
```

---

### **Shared: Embeddings Table**

Stores vector embeddings for both admin and user knowledge.

```sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,

  -- Ownership (NULL = admin knowledge, UUID = user knowledge)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_knowledge_file_id UUID REFERENCES user_knowledge_files(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Vector (OpenAI)
  embedding VECTOR(1536),

  -- Gemini corpus (alternative)
  gemini_corpus_id TEXT,
  gemini_document_id TEXT,

  embedding_status TEXT DEFAULT 'completed',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_user_id ON embeddings(user_id);
CREATE INDEX idx_embeddings_user_knowledge_file ON embeddings(user_knowledge_file_id);
```

---

## 🔧 Edge Functions

### **1. `google-drive-sync`**

**Purpose:** Sync files from Google Drive to knowledge base.

**Endpoint:** `POST /functions/v1/google-drive-sync`

**Request:**
```typescript
{
  action: 'list-files' | 'sync-selected';
  folder_url?: string;
  source_id: string;
  file_ids?: string[]; // For sync-selected
}
```

**Response (list-files):**
```typescript
{
  success: boolean;
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    webViewLink: string;
    modifiedTime: string;
  }>;
}
```

**Response (sync-selected):**
```typescript
{
  success: boolean;
  synced_files: Array<{
    id: string;
    file_name: string;
    external_id: string;
  }>;
}
```

---

### **2. `user-knowledge-upload`**

**Purpose:** Upload files to user's personal knowledge.

**Endpoint:** `POST /functions/v1/user-knowledge-upload`

**Request:** FormData with:
- `source_id`: string
- `files`: File[]

**Response:**
```typescript
{
  success: boolean;
  uploaded_files: Array<{
    id: string;
    file_name: string;
    file_size: number;
    storage_path: string;
  }>;
  errors?: string[];
}
```

---

### **3. `user-knowledge-process`**

**Purpose:** Background job to generate embeddings for user knowledge.

**Trigger:** Scheduled (cron) or manual

**Process:**
1. Query files with `processing_status = 'pending'`
2. Download content
3. Extract text
4. Chunk into 500-token chunks
5. Generate embeddings (OpenAI or Gemini)
6. Store in `embeddings` table
7. Update file status

---

### **4. `generate-embeddings`**

**Purpose:** Generate vector embeddings for content.

**Endpoint:** `POST /functions/v1/generate-embeddings`

**Request:**
```typescript
{
  entity_type: string;
  entity_id: string;
  content: string;
  metadata?: Record<string, any>;
  user_id?: string;
  chunk_size?: number;
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

### **Admin Knowledge**

#### `useKnowledgeEntries`

```typescript
import { useKnowledgeEntries } from '@/hooks/useKnowledge';

const { data: entries, isLoading } = useKnowledgeEntries({
  category_id: categoryId,
  status: 'published'
});
```

#### `useKnowledgeCategories`

```typescript
import { useKnowledgeCategories } from '@/hooks/useKnowledge';

const { data: categories } = useKnowledgeCategories();
```

#### `useSearchKnowledge`

```typescript
import { useSearchKnowledge } from '@/hooks/useKnowledge';

const { data: results } = useSearchKnowledge(
  "api integration", // Query (min 3 chars)
  ['guide', 'document'] // Optional: filter by types
);
```

---

### **Personal Knowledge**

#### `useUserKnowledgeSources`

```typescript
import { useUserKnowledgeSources } from '@/hooks/useUserKnowledge';

const { data: sources } = useUserKnowledgeSources();
```

#### `useUserKnowledgeFiles`

```typescript
import { useUserKnowledgeFiles } from '@/hooks/useUserKnowledge';

const { data: files } = useUserKnowledgeFiles(sourceId);
```

#### `useUploadUserKnowledgeFiles`

```typescript
import { useUploadUserKnowledgeFiles } from '@/hooks/useUserKnowledge';

const { mutate: upload, isLoading } = useUploadUserKnowledgeFiles();

upload({
  sourceId: 'uuid',
  files: selectedFiles
});
```

---

## 🎨 UI Components

### **Knowledge Base Browser**

**Location:** `/src/pages/KnowledgeBase.tsx`

**Features:**
- Category sidebar
- Entry list view
- Search bar
- Filter by type/status
- Entry detail modal

---

### **Personal Knowledge Dashboard**

**Location:** `/src/pages/PersonalKnowledge.tsx`

**Features:**
- File upload modal (drag & drop)
- Google Drive folder picker
- List of sources and files
- Status badges (pending, processing, indexed)
- Delete files/sources
- Embedding statistics

**Layout:**
```
+--------------------------------------------------+
| Personal Knowledge Library                       |
| [Upload Files] [Connect Google Drive]            |
+--------------------------------------------------+
| Sources (3)                       Files (12)     |
+--------------------------------------------------+
| 📁 Client Notes        | 📄 acme-notes.pdf       |
|    Google Drive        |    Indexed (23 chunks)  |
|    Last sync: 2h ago   |    Modified: 1d ago     |
+--------------------------------------------------+
```

---

### **UserKnowledgeUploadModal**

**Location:** `/src/components/user-knowledge/UserKnowledgeUploadModal.tsx`

**Props:**
```typescript
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId?: string;
}
```

**Features:**
- Source selector
- Drag & drop file upload
- Multiple file support
- Progress indicators
- Error handling

---

### **UserGoogleDriveFilePicker**

**Location:** `/src/components/user-knowledge/UserGoogleDriveFilePicker.tsx`

**Features:**
- Paste Google Drive folder URL
- List files in folder
- Select specific files to sync
- OAuth flow integration

---

## 📈 Best Practices

### **1. Search Optimization**

**Full-Text Search:**
```sql
-- Use PostgreSQL full-text search for exact matches
SELECT * FROM knowledge_entries
WHERE search_vector @@ to_tsquery('api & integration');
```

**Semantic Search:**
```sql
-- Use vector similarity for conceptual matches
SELECT * FROM search_knowledge(
  'how to integrate APIs',
  ARRAY['guide']
);
```

**Hybrid Approach:**
- Use full-text search first for exact keyword matches
- Fall back to semantic search for broader results
- Combine results and de-duplicate

---

### **2. File Processing**

**Best Practices:**
- ✅ Process files in batches (10-20 at a time)
- ✅ Use consistent chunk sizes (800-1000 chars)
- ✅ Include metadata (file name, author, date)
- ✅ Set retry limits (max 3 retries)
- ❌ Don't process files larger than 50 MB
- ❌ Don't skip validation of file types

---

### **3. Personal Knowledge**

**User Privacy:**
- ✅ Always enforce RLS on user tables
- ✅ Store files under `{user_id}/` paths
- ✅ Tag embeddings with `user_id`
- ❌ Never expose user knowledge to other users
- ❌ Don't allow admin override without consent

**Storage Limits:**
- Per-file: 100 MB max
- Per-user daily upload: 1 GB
- Embedding generation: 100 files/day

---

## 💰 Cost Estimation

### **Storage Costs (Supabase)**

| Item | Size per File | Example (100 files) |
|------|---------------|---------------------|
| Database records | ~1 KB | 100 KB |
| Embeddings | ~1.5 KB × 20 chunks | 3 MB |
| File storage | Actual file size | 50 MB (500 KB avg) |
| **Total** | | **~53 MB** |

---

### **Embedding Generation Costs**

**OpenAI (text-embedding-3-small):** $0.02 per 1M tokens

Example:
- 100 files × 10 pages × 500 tokens/page = 500K tokens
- Cost: **$0.01**

**Gemini (text-embedding-004):** $0.000025 per 1K characters

Example:
- 100 files × 10 pages × 2000 chars/page = 2M characters
- Cost: **$0.05**

---

## 🔒 Security

### **Row-Level Security (RLS)**

```sql
-- User knowledge sources
CREATE POLICY "Users can view own sources"
  ON user_knowledge_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sources"
  ON user_knowledge_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User knowledge files
CREATE POLICY "Users can view own files"
  ON user_knowledge_files FOR SELECT
  USING (auth.uid() = user_id);

-- User embeddings
CREATE POLICY "Users can view own embeddings"
  ON embeddings FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id IS NULL -- Allow viewing admin embeddings
  );
```

---

### **Storage Bucket Policies**

```sql
-- User knowledge bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-knowledge', 'user-knowledge', false);

-- Users can upload to own folder
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-knowledge'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view own files
CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-knowledge'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## 🚀 Quick Start

### **1. Create Admin Knowledge Entry**

```typescript
const { data } = await supabase
  .from('knowledge_entries')
  .insert({
    title: 'API Integration Guide',
    content: 'Full guide content here...',
    summary: 'How to integrate with external APIs',
    entry_type: 'guide',
    category_id: categoryId,
    status: 'published'
  })
  .select()
  .single();
```

---

### **2. Upload Personal Knowledge File**

```typescript
const formData = new FormData();
formData.append('source_id', sourceId);
formData.append('files', selectedFile);

const response = await fetch('/functions/v1/user-knowledge-upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
});
```

---

### **3. Search Knowledge Base**

```typescript
const { data } = await supabase
  .rpc('search_knowledge', {
    search_query: 'api integration',
    entry_types: ['guide', 'document']
  });
```

---

## 📚 Additional Resources

- [knowledge.md](../knowledge.md) - Personal Knowledge System implementation plan
- [KNOWLEDGE-MIGRATION-GUIDE.md](../KNOWLEDGE-MIGRATION-GUIDE.md) - Migration guide
- [GEMINI_RAG_IMPLEMENTATION.md](../GEMINI_RAG_IMPLEMENTATION.md) - Gemini RAG setup

---

## 🐛 Troubleshooting

### **Search Returns No Results**

**Solutions:**
1. Check if entries are published: `SELECT * FROM knowledge_entries WHERE status = 'published'`
2. Verify search_vector is populated
3. Test semantic search with lower threshold

### **File Processing Stuck**

**Solutions:**
1. Check processing status: `SELECT * FROM user_knowledge_files WHERE processing_status = 'failed'`
2. Review error messages
3. Manually retry: Update `processing_status` to 'pending'

### **Google Drive Sync Fails**

**Solutions:**
1. Verify OAuth token is valid
2. Check folder permissions
3. Review API quota limits

---

**Last Updated:** 2025-12-25
**Version:** 1.0.0
**Module:** Knowledge Base
