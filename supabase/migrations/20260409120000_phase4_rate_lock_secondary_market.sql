-- Phase 4: Rate lock & secondary market — additive schema (manual workflows + optional vendor hooks later)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) rate_locks — traceability fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rate_locks
  ADD COLUMN IF NOT EXISTS rate_sheet_id UUID REFERENCES public.rate_sheets(id) ON DELETE SET NULL;
ALTER TABLE public.rate_locks
  ADD COLUMN IF NOT EXISTS investor_code TEXT;
ALTER TABLE public.rate_locks
  ADD COLUMN IF NOT EXISTS price_at_lock NUMERIC(8,4);
ALTER TABLE public.rate_locks ADD COLUMN IF NOT EXISTS source TEXT;
UPDATE public.rate_locks SET source = 'manual' WHERE source IS NULL;
ALTER TABLE public.rate_locks ALTER COLUMN source SET DEFAULT 'manual';
ALTER TABLE public.rate_locks ALTER COLUMN source SET NOT NULL;
ALTER TABLE public.rate_locks DROP CONSTRAINT IF EXISTS rate_locks_source_chk;
ALTER TABLE public.rate_locks ADD CONSTRAINT rate_locks_source_chk CHECK (source IN ('manual', 'pricing_quote'));

COMMENT ON COLUMN public.rate_locks.source IS 'manual | pricing_quote — how the lock was originated.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Best-execution / pricing snapshots (read-only display on loan + pipeline exports)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_pricing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  computed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  best_execution BOOLEAN NOT NULL DEFAULT false,
  winner_investor_code TEXT,
  winner_product_name TEXT,
  winner_rate NUMERIC(8,4),
  winner_price NUMERIC(8,4),
  winner_quote_type TEXT,
  results_count INT,
  scenario_dims JSONB DEFAULT '{}'::jsonb,
  raw_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_loan_pricing_snapshots_loan ON public.loan_pricing_snapshots(loan_id, computed_at DESC);

COMMENT ON TABLE public.loan_pricing_snapshots IS 'Latest pricing / best-execution snapshot per run for loan file visibility.';

ALTER TABLE public.loan_pricing_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_pricing_snapshots_select" ON public.loan_pricing_snapshots;
CREATE POLICY "loan_pricing_snapshots_select"
  ON public.loan_pricing_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_pricing_snapshots.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
          OR (
            public.is_branch_manager(auth.uid())
            AND l.branch_id IS NOT NULL
            AND l.branch_id = public.user_branch_id(auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "loan_pricing_snapshots_insert" ON public.loan_pricing_snapshots;
CREATE POLICY "loan_pricing_snapshots_insert"
  ON public.loan_pricing_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_pricing_snapshots.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Investor submission / delivery workflow (manual v1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.investor_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  investor_code TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'in_review', 'cleared', 'rejected')),
  submitted_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investor_submissions_loan ON public.investor_submissions(loan_id);

ALTER TABLE public.investor_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investor_submissions_select" ON public.investor_submissions;
CREATE POLICY "investor_submissions_select"
  ON public.investor_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = investor_submissions.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
          OR (
            public.is_branch_manager(auth.uid())
            AND l.branch_id IS NOT NULL
            AND l.branch_id = public.user_branch_id(auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "investor_submissions_mutate" ON public.investor_submissions;
CREATE POLICY "investor_submissions_mutate"
  ON public.investor_submissions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = investor_submissions.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = investor_submissions.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Hedge analytics (assumptions + optional computed snapshot)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hedge_assumptions_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'default',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.hedge_assumptions_versions.assumptions IS 'e.g. pull_through_pct, dv01_placeholder_millions, commentary';

CREATE TABLE IF NOT EXISTS public.hedge_pipeline_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  locked_volume NUMERIC(18,2),
  active_lock_count INT,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  assumptions_snapshot JSONB,
  computed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hedge_snapshots_date ON public.hedge_pipeline_snapshots(snapshot_date DESC);

ALTER TABLE public.hedge_assumptions_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hedge_pipeline_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hedge_assumptions_select" ON public.hedge_assumptions_versions;
CREATE POLICY "hedge_assumptions_select"
  ON public.hedge_assumptions_versions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hedge_assumptions_admin" ON public.hedge_assumptions_versions;
CREATE POLICY "hedge_assumptions_admin"
  ON public.hedge_assumptions_versions FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "hedge_pipeline_snapshots_select" ON public.hedge_pipeline_snapshots;
CREATE POLICY "hedge_pipeline_snapshots_select"
  ON public.hedge_pipeline_snapshots FOR SELECT TO authenticated
  USING (
    public.has_role('admin'::public.app_role, auth.uid())
    OR public.is_branch_manager(auth.uid())
  );

DROP POLICY IF EXISTS "hedge_pipeline_snapshots_insert" ON public.hedge_pipeline_snapshots;
CREATE POLICY "hedge_pipeline_snapshots_insert"
  ON public.hedge_pipeline_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin'::public.app_role, auth.uid())
    OR public.is_branch_manager(auth.uid())
  );

INSERT INTO public.hedge_assumptions_versions (name, effective_date, assumptions, is_active)
SELECT
  'Default v1',
  CURRENT_DATE,
  '{"pull_through_pct": 0.75, "dv01_placeholder_millions": null, "notes": "Illustrative only — not for trading."}'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.hedge_assumptions_versions WHERE name = 'Default v1');
