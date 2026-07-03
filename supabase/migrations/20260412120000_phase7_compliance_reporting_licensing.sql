-- Phase 7: Compliance reporting & licensing (manual-first baseline)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) HMDA LAR tracking per loan (single current row per loan)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hmda_lar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL UNIQUE REFERENCES public.loans(id) ON DELETE CASCADE,
  filing_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INT,
  is_reportable BOOLEAN NOT NULL DEFAULT true,
  action_taken TEXT CHECK (
    action_taken IN (
      'originated',
      'approved_not_accepted',
      'denied',
      'withdrawn',
      'closed_incomplete',
      'purchased',
      'preapproval_denied',
      'preapproval_approved_not_accepted'
    )
  ),
  action_taken_date DATE,
  loan_purpose TEXT CHECK (loan_purpose IN ('home_purchase', 'home_improvement', 'refinancing', 'cash_out_refi', 'other')),
  loan_type TEXT CHECK (loan_type IN ('conventional', 'fha', 'va', 'usda_rhs', 'other')),
  occupancy_type TEXT CHECK (occupancy_type IN ('primary', 'second_home', 'investment')),
  lien_status TEXT CHECK (lien_status IN ('first_lien', 'subordinate_lien', 'unsecured', 'not_applicable')),
  purchaser_type TEXT,
  hoepa_status TEXT CHECK (hoepa_status IN ('not_hoepa', 'hoepa')),
  rate_spread NUMERIC(8,4),
  denial_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  lar_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hmda_lar_entries_filing_year ON public.hmda_lar_entries(filing_year);
CREATE INDEX IF NOT EXISTS idx_hmda_lar_entries_action_taken ON public.hmda_lar_entries(action_taken);

COMMENT ON TABLE public.hmda_lar_entries IS 'Manual HMDA LAR staging per loan; baseline for reporting/export.';

ALTER TABLE public.hmda_lar_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hmda_lar_entries_select" ON public.hmda_lar_entries;
CREATE POLICY "hmda_lar_entries_select"
  ON public.hmda_lar_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = hmda_lar_entries.loan_id
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

DROP POLICY IF EXISTS "hmda_lar_entries_mutate" ON public.hmda_lar_entries;
CREATE POLICY "hmda_lar_entries_mutate"
  ON public.hmda_lar_entries FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = hmda_lar_entries.loan_id
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = hmda_lar_entries.loan_id
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) HMDA report run audit (admin only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hmda_report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_year INT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  included_rows INT NOT NULL DEFAULT 0,
  excluded_rows INT NOT NULL DEFAULT 0,
  export_format TEXT NOT NULL DEFAULT 'csv',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hmda_report_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hmda_report_runs_admin_only" ON public.hmda_report_runs;
CREATE POLICY "hmda_report_runs_admin_only"
  ON public.hmda_report_runs FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) NMLS / licensing tracker (admin/compliance ops)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nmls_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_type TEXT NOT NULL CHECK (holder_type IN ('individual', 'branch', 'company')),
  holder_name TEXT NOT NULL DEFAULT '',
  holder_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nmls_id TEXT,
  state_code TEXT NOT NULL,
  license_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'pending', 'expired', 'suspended', 'revoked')),
  issue_date DATE,
  expiration_date DATE,
  renewed_at DATE,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (holder_type, holder_name, state_code, license_number)
);

CREATE INDEX IF NOT EXISTS idx_nmls_licenses_expiration ON public.nmls_licenses(expiration_date);
CREATE INDEX IF NOT EXISTS idx_nmls_licenses_state ON public.nmls_licenses(state_code);

ALTER TABLE public.nmls_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nmls_licenses_admin_only" ON public.nmls_licenses;
CREATE POLICY "nmls_licenses_admin_only"
  ON public.nmls_licenses FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));
