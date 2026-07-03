-- Apply pending knowledge schema migrations: create knowledge_categories, mortgage upgrade, and 20260514140000 admin RLS.

-- 1) Create knowledge_categories
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
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_parent_sort ON public.knowledge_categories (parent_id, sort_order);
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;

-- 2) Upgrade columns
ALTER TABLE public.knowledge_categories
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS governance_owner_role text,
  ADD COLUMN IF NOT EXISTS review_cadence_days integer,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS deprecated_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_regulatory_critical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_categories_lifecycle_state_check') THEN
    ALTER TABLE public.knowledge_categories ADD CONSTRAINT knowledge_categories_lifecycle_state_check
      CHECK (lifecycle_state IN ('active','deprecated','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_categories_review_cadence_days_check') THEN
    ALTER TABLE public.knowledge_categories ADD CONSTRAINT knowledge_categories_review_cadence_days_check
      CHECK (review_cadence_days IS NULL OR review_cadence_days >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_categories_lifecycle_state ON public.knowledge_categories (lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_effective_date ON public.knowledge_categories (effective_date);

-- Seed parent categories
WITH parent_seed(name, slug, description, sort_order, owner_role, review_cadence_days, is_regulatory_critical, aliases) AS (
  VALUES
    ('Mortgage Topics','mortgage-topics','Core mortgage-domain education, SOPs, and reference topics across origination and servicing.',5,'Loan Officer',30,false,ARRAY['mortgage-domain','mortgage-knowledge']::text[]),
    ('Loan Lifecycle','loan-lifecycle','Knowledge tied to mortgage pipeline stages from intake through post-closing.',10,'Loan Officer',30,false,ARRAY['pipeline','loan-stages']::text[]),
    ('Product and Pricing','product-and-pricing','Guidance for loan products, rate sheets, lock policy, and pricing workflows.',20,'Secondary Marketing',14,true,ARRAY['pricing','rate-locks']::text[]),
    ('Documents and Conditions','documents-and-conditions','Document checklists, condition clearing guides, and compliance artifacts.',30,'Underwriter',30,true,ARRAY['docs','conditions']::text[]),
    ('Borrower Communication','borrower-communication','Templates and playbooks for borrower and partner communication.',40,'Processor',21,false,ARRAY['borrower-updates','message-playbooks']::text[]),
    ('Operations and Risk','operations-and-risk','Operational controls, SLA management, escalation paths, and exception handling.',50,'Operations Manager',14,true,ARRAY['sla','risk-controls']::text[])
)
INSERT INTO public.knowledge_categories (name, slug, description, sort_order, lifecycle_state, governance_owner_role, review_cadence_days, effective_date, is_regulatory_critical, aliases)
SELECT name, slug, description, sort_order, 'active', owner_role, review_cadence_days, CURRENT_DATE, is_regulatory_critical, aliases FROM parent_seed
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description, sort_order = EXCLUDED.sort_order, lifecycle_state='active',
  governance_owner_role = EXCLUDED.governance_owner_role, review_cadence_days = EXCLUDED.review_cadence_days,
  effective_date = COALESCE(public.knowledge_categories.effective_date, EXCLUDED.effective_date),
  is_regulatory_critical = EXCLUDED.is_regulatory_critical, aliases = EXCLUDED.aliases, updated_at = now();

WITH child_seed(parent_slug, name, slug, sort_order, owner_role) AS (
  VALUES
    ('mortgage-topics','Mortgage Basics','mortgage-basics',1,'Loan Officer'),
    ('mortgage-topics','Loan Programs and Eligibility','loan-programs-and-eligibility',2,'Loan Officer'),
    ('mortgage-topics','Underwriting Guidelines','underwriting-guidelines',3,'Underwriter'),
    ('mortgage-topics','Rate Locks and Pricing Concepts','rate-locks-and-pricing-concepts',4,'Secondary Marketing'),
    ('mortgage-topics','Closing and Post-Closing','closing-and-post-closing',5,'Closer'),
    ('mortgage-topics','Mortgage Compliance Topics','mortgage-compliance-topics',6,'Compliance'),
    ('loan-lifecycle','Lead Intake','lead-intake',1,'Loan Officer'),
    ('loan-lifecycle','Application','application',2,'Loan Officer'),
    ('loan-lifecycle','Processing','processing',3,'Processor'),
    ('loan-lifecycle','Underwriting','underwriting',4,'Underwriter'),
    ('loan-lifecycle','Conditional Approval','conditional-approval',5,'Underwriter'),
    ('loan-lifecycle','Closing','closing',6,'Closer'),
    ('loan-lifecycle','Post-Closing','post-closing',7,'Post Closer'),
    ('product-and-pricing','Conventional','conventional',1,'Secondary Marketing'),
    ('product-and-pricing','FHA','fha',2,'Secondary Marketing'),
    ('product-and-pricing','VA','va',3,'Secondary Marketing'),
    ('product-and-pricing','USDA','usda',4,'Secondary Marketing'),
    ('product-and-pricing','Jumbo','jumbo',5,'Secondary Marketing'),
    ('product-and-pricing','Lock Policy','lock-policy',6,'Secondary Marketing'),
    ('product-and-pricing','Rate Sheet Operations','rate-sheet-operations',7,'Secondary Marketing'),
    ('documents-and-conditions','Income Documents','income-documents',1,'Processor'),
    ('documents-and-conditions','Asset Documents','asset-documents',2,'Processor'),
    ('documents-and-conditions','Credit Documents','credit-documents',3,'Underwriter'),
    ('documents-and-conditions','Property Documents','property-documents',4,'Processor'),
    ('documents-and-conditions','Condition Clearing','condition-clearing',5,'Underwriter'),
    ('documents-and-conditions','Trailing Documents','trailing-documents',6,'Post Closer'),
    ('borrower-communication','Status Updates','status-updates',1,'Processor'),
    ('borrower-communication','Condition Requests','condition-requests',2,'Processor'),
    ('borrower-communication','Rate Lock Reminders','rate-lock-reminders',3,'Loan Officer'),
    ('borrower-communication','Closing Notices','closing-notices',4,'Closer'),
    ('borrower-communication','Realtor Updates','realtor-updates',5,'Loan Officer'),
    ('operations-and-risk','Pipeline Prioritization','pipeline-prioritization',1,'Operations Manager'),
    ('operations-and-risk','SLA and Turn Times','sla-and-turn-times',2,'Operations Manager'),
    ('operations-and-risk','Escalations','escalations',3,'Operations Manager'),
    ('operations-and-risk','Compliance Checklists','compliance-checklists',4,'Compliance'),
    ('operations-and-risk','Exceptions','exceptions',5,'Compliance')
)
INSERT INTO public.knowledge_categories (parent_id, name, slug, description, sort_order, lifecycle_state, governance_owner_role, review_cadence_days, effective_date, is_regulatory_critical, aliases)
SELECT p.id, c.name, c.slug, c.name || ' guidance and SOPs', c.sort_order, 'active', c.owner_role, 30, CURRENT_DATE, false, ARRAY[]::text[]
FROM child_seed c JOIN public.knowledge_categories p ON p.slug = c.parent_slug
ON CONFLICT (slug) DO UPDATE SET
  parent_id = EXCLUDED.parent_id, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order,
  lifecycle_state='active', governance_owner_role = EXCLUDED.governance_owner_role,
  review_cadence_days = EXCLUDED.review_cadence_days,
  effective_date = COALESCE(public.knowledge_categories.effective_date, EXCLUDED.effective_date),
  updated_at = now();

-- 3) 20260514140000 admin RLS + columns
DROP POLICY IF EXISTS knowledge_categories_authenticated_all ON public.knowledge_categories;
DROP POLICY IF EXISTS knowledge_categories_select_authenticated ON public.knowledge_categories;
CREATE POLICY knowledge_categories_select_authenticated
  ON public.knowledge_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS knowledge_categories_admin_manage ON public.knowledge_categories;
CREATE POLICY knowledge_categories_admin_manage
  ON public.knowledge_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'moderator'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'moderator'::public.app_role));

DROP TRIGGER IF EXISTS knowledge_categories_updated_at ON public.knowledge_categories;
CREATE TRIGGER knowledge_categories_updated_at BEFORE UPDATE ON public.knowledge_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.knowledge_categories(id) ON DELETE SET NULL;
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.knowledge_entries SET slug = 'entry-' || replace(id::text,'-','') WHERE slug IS NULL OR btrim(slug)='';
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_entries_slug_unique ON public.knowledge_entries (slug);

DROP POLICY IF EXISTS knowledge_entries_insert_own ON public.knowledge_entries;
CREATE POLICY knowledge_entries_insert_own ON public.knowledge_entries FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() OR (author_id IS NULL AND created_by = auth.uid()));
DROP POLICY IF EXISTS knowledge_entries_update_own ON public.knowledge_entries;
CREATE POLICY knowledge_entries_update_own ON public.knowledge_entries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR author_id=auth.uid() OR created_by=auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR author_id=auth.uid() OR created_by=auth.uid());
DROP POLICY IF EXISTS knowledge_entries_delete_own ON public.knowledge_entries;
CREATE POLICY knowledge_entries_delete_own ON public.knowledge_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR author_id=auth.uid() OR created_by=auth.uid());

DROP POLICY IF EXISTS document_extracts_select_staff ON public.document_extracts;
CREATE POLICY document_extracts_select_staff ON public.document_extracts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'moderator'::public.app_role));

INSERT INTO public.knowledge_categories (name, slug, description, sort_order)
VALUES ('General','general','Uncategorized or quick uploads; optional category for loan officers.',-1)
ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description, updated_at = now();