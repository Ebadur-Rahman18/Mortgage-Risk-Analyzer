-- Align owner column with app inserts (KnowledgeUpload / useKnowledge use author_id).
ALTER TABLE public.knowledge_entries
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.knowledge_entries
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Parsed document text + structure for Knowledge uploads and future loan-file ingestion.

CREATE TABLE IF NOT EXISTS public.document_extracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_entry_id UUID REFERENCES public.knowledge_entries(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'user-knowledge',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  byte_size BIGINT,
  parse_status TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT document_extracts_parse_status_check CHECK (
    parse_status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'error'::text])
  ),
  parse_error TEXT,
  page_count INT,
  word_count INT,
  extracted_text TEXT,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  tables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  parsed_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_extracts IS 'Server-side parsed text/metadata for uploaded documents (Knowledge and future loan files).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_extracts_knowledge_entry_unique
  ON public.document_extracts (knowledge_entry_id)
  WHERE knowledge_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_extracts_uploaded_by ON public.document_extracts (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_document_extracts_status ON public.document_extracts (parse_status);

DROP TRIGGER IF EXISTS document_extracts_updated_at ON public.document_extracts;
CREATE TRIGGER document_extracts_updated_at
  BEFORE UPDATE ON public.document_extracts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.document_extracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_extracts_select_own ON public.document_extracts;
CREATE POLICY document_extracts_select_own
  ON public.document_extracts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.knowledge_entries k
      WHERE k.id = document_extracts.knowledge_entry_id
        AND COALESCE(k.author_id, k.created_by) = auth.uid()
    )
  );

-- Inserts/updates are performed by the parse-document edge function (service role).
-- No INSERT/UPDATE policies for authenticated clients.
