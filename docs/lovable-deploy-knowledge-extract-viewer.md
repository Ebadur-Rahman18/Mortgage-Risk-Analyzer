# Lovable Deploy Prompt — Knowledge Base Document Extract Viewer + RAG

Copy the block below into Lovable after merging `feature/knowledge-extract-viewer-rag`.

```
Merge branch feature/knowledge-extract-viewer-rag. Deploy these edge functions after merge:

  npx supabase functions deploy parse-document
  npx supabase functions deploy generate-embeddings

No new database migration required — uses existing document_extracts table.

WHAT SHIPPED:

1. User-facing extract viewer (Knowledge Base)
   - New component: src/components/knowledge/DocumentExtractViewer.tsx
   - Tabs: Sections (accordion by page), Full text, Tables, Raw JSON
   - Download .txt / .json, copy text, "Ready for AI agents" badge
   - KnowledgeDetail.tsx shows full viewer on every uploaded file article
   - KnowledgeUpload.tsx polls parse-document and shows inline extract preview after upload

2. Improved PDF parsing (parse-document edge function)
   - Per-page section extraction via unpdf mergePages: false
   - Falls back to merged text if per-page fails
   - sections[] stored with title "Page N", page number, and text

3. Better RAG embeddings (generate-embeddings edge function)
   - Loads full extracted_text from document_extracts (not just 8k from trigger payload)
   - Embeds up to 8000 chars into content_embedding on document_extracts

4. Agent search improvements (tool-executor in run-ai-agent)
   - search_knowledge_base returns section_title + page when match is in a section
   - Excerpt centered on matched section text instead of always first 1200 chars

QA CHECKLIST:
[ ] Upload a PDF from /knowledge/upload → wait for "Extract preview" on upload page
[ ] Open article → "Extracted document" card shows sections accordion with pages
[ ] Download .txt and .json work
[ ] Ask AI agent a question about uploaded doc content → agent cites document_extract source
[ ] Admin → Document extracts still lists all parsed rows
[ ] Re-parse from article detail still works ("Extract text again")
```
