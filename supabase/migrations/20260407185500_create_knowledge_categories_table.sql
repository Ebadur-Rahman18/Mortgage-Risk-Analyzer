-- Create knowledge_categories before 20260407190000_mortgage_knowledge_categories_upgrade.sql (which ALTERs this table).
-- Fresh databases previously failed at ALTER with "relation does not exist".

CREATE TABLE IF NOT EXISTS public.knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  parent_id UUID REFERENCES public.knowledge_categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_categories_slug_unique UNIQUE (slug),
  CONSTRAINT knowledge_categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_categories_parent_sort
  ON public.knowledge_categories (parent_id, sort_order);

COMMENT ON TABLE public.knowledge_categories IS 'Taxonomy for knowledge base articles.';

-- Allow all authenticated users to manage categories until stricter policies are applied in a later migration.
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_categories_authenticated_all ON public.knowledge_categories;
CREATE POLICY knowledge_categories_authenticated_all
  ON public.knowledge_categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
