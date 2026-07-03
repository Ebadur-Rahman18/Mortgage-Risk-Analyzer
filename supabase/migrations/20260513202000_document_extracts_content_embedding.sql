-- Vector embedding for parsed knowledge documents (semantic search / AI retrieval).

ALTER TABLE public.document_extracts
  ADD COLUMN IF NOT EXISTS content_embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_document_extracts_content_embedding_hnsw
  ON public.document_extracts
  USING hnsw (content_embedding vector_cosine_ops)
  WHERE content_embedding IS NOT NULL;

COMMENT ON COLUMN public.document_extracts.content_embedding IS 'OpenAI text-embedding-3-small vector for extracted_text; set by generate-embeddings.';
