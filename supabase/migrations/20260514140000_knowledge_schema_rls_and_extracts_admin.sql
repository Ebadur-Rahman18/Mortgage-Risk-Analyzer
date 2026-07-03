-- Tighten knowledge_categories RLS, align knowledge_entries with the app, author CRUD policies,
-- staff read on document_extracts, and seed a default category slug.

-- ── knowledge_categories: replace permissive policies ────────────────────────
DROP POLICY IF EXISTS knowledge_categories_authenticated_all ON public.knowledge_categories;

DROP POLICY IF EXISTS knowledge_categories_select_authenticated ON public.knowledge_categories;
CREATE POLICY knowledge_categories_select_authenticated
  ON public.knowledge_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS knowledge_categories_admin_manage ON public.knowledge_categories;
CREATE POLICY knowledge_categories_admin_manage
  ON public.knowledge_categories FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

DROP TRIGGER IF EXISTS knowledge_categories_updated_at ON public.knowledge_categories;
CREATE TRIGGER knowledge_categories_updated_at
  BEFORE UPDATE ON public.knowledge_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ── knowledge_entries: columns expected by app & seeds ─────────────────────
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES public.knowledge_categories(id) ON DELETE SET NULL;
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.knowledge_entries
SET slug = 'entry-' || replace(id::text, '-', '')
WHERE slug IS NULL OR btrim(slug) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_entries_slug_unique ON public.knowledge_entries (slug);

-- Author / owner can create and manage their own entries (in addition to knowledge_admin_write).
DROP POLICY IF EXISTS knowledge_entries_insert_own ON public.knowledge_entries;
CREATE POLICY knowledge_entries_insert_own
  ON public.knowledge_entries FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    OR (author_id IS NULL AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_entries_update_own ON public.knowledge_entries;
CREATE POLICY knowledge_entries_update_own
  ON public.knowledge_entries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR author_id = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR author_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS knowledge_entries_delete_own ON public.knowledge_entries;
CREATE POLICY knowledge_entries_delete_own
  ON public.knowledge_entries FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR author_id = auth.uid()
    OR created_by = auth.uid()
  );

-- ── document_extracts: admins/moderators can list all (admin UI) ─────────────
DO $$
BEGIN
  IF to_regclass('public.document_extracts') IS NOT NULL THEN
    DROP POLICY IF EXISTS document_extracts_select_staff ON public.document_extracts;
    CREATE POLICY document_extracts_select_staff
      ON public.document_extracts FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      );
  END IF;
END $$;

-- ── Default category for optional uploads ────────────────────────────────────
INSERT INTO public.knowledge_categories (name, slug, description, sort_order)
VALUES (
  'General',
  'general',
  'Uncategorized or quick uploads; optional category for loan officers.',
  -1
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();
