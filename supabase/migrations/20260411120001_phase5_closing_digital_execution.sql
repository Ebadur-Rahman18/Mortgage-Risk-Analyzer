-- Phase 5: Closing & digital execution — manual-first workflows + optional vendor hooks (integrations off by default).

-- Reusable loan access expression (same pattern as Phase 3/4)
-- SELECT uses: LO, UW, admin, BM same branch

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Settlement services: flood / title / HOI (+ other)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_settlement_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL
    CHECK (order_type IN ('flood', 'title', 'homeowners_insurance', 'other')),
  status TEXT NOT NULL DEFAULT 'not_ordered'
    CHECK (status IN ('not_ordered', 'ordered', 'in_progress', 'received', 'cleared', 'cancelled')),
  vendor_name TEXT,
  reference_number TEXT,
  ordered_at TIMESTAMPTZ,
  expected_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_settlement_orders_loan ON public.loan_settlement_orders(loan_id);

COMMENT ON TABLE public.loan_settlement_orders IS 'Manual tracking of flood cert, title, insurance orders; optional vendor integrations later.';

ALTER TABLE public.loan_settlement_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_settlement_orders_select" ON public.loan_settlement_orders;
CREATE POLICY "loan_settlement_orders_select"
  ON public.loan_settlement_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_settlement_orders.loan_id
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

DROP POLICY IF EXISTS "loan_settlement_orders_mutate" ON public.loan_settlement_orders;
CREATE POLICY "loan_settlement_orders_mutate"
  ON public.loan_settlement_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_settlement_orders.loan_id
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
      WHERE l.id = loan_settlement_orders.loan_id
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
-- 2) Appraisal management (manual)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_appraisal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_ordered'
    CHECK (status IN (
      'not_ordered', 'ordered', 'inspection_scheduled', 'report_received',
      'under_review', 'accepted', 'revisions_requested', 'waived', 'cancelled'
    )),
  vendor_name TEXT,
  amc_reference TEXT,
  appraisal_fee NUMERIC(12,2),
  ordered_at TIMESTAMPTZ,
  inspection_date DATE,
  report_received_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_appraisal_orders_loan ON public.loan_appraisal_orders(loan_id);

ALTER TABLE public.loan_appraisal_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_appraisal_orders_select" ON public.loan_appraisal_orders;
CREATE POLICY "loan_appraisal_orders_select"
  ON public.loan_appraisal_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_appraisal_orders.loan_id
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

DROP POLICY IF EXISTS "loan_appraisal_orders_mutate" ON public.loan_appraisal_orders;
CREATE POLICY "loan_appraisal_orders_mutate"
  ON public.loan_appraisal_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_appraisal_orders.loan_id
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
      WHERE l.id = loan_appraisal_orders.loan_id
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
-- 3) RON (remote online notarization) sessions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_ron_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_scheduled'
    CHECK (status IN ('not_scheduled', 'scheduled', 'in_session', 'completed', 'cancelled', 'failed')),
  vendor_name TEXT,
  provider_session_ref TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_ron_sessions_loan ON public.loan_ron_sessions(loan_id);

ALTER TABLE public.loan_ron_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_ron_sessions_select" ON public.loan_ron_sessions;
CREATE POLICY "loan_ron_sessions_select"
  ON public.loan_ron_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_ron_sessions.loan_id
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

DROP POLICY IF EXISTS "loan_ron_sessions_mutate" ON public.loan_ron_sessions;
CREATE POLICY "loan_ron_sessions_mutate"
  ON public.loan_ron_sessions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_ron_sessions.loan_id
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
      WHERE l.id = loan_ron_sessions.loan_id
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
-- 4) eClose / eNote tracking (manual checklist — not a full eClosing platform)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_digital_closing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL UNIQUE REFERENCES public.loans(id) ON DELETE CASCADE,
  eclose_package_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (eclose_package_status IN ('not_started', 'draft', 'sent', 'borrower_signed', 'completed', 'n_a')),
  enote_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (enote_status IN ('not_started', 'pending', 'registered', 'n_a', 'wet_note')),
  closing_scheduled_date DATE,
  closing_completed_at TIMESTAMPTZ,
  package_sent_at TIMESTAMPTZ,
  vendor_name TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_digital_closing_loan ON public.loan_digital_closing(loan_id);

ALTER TABLE public.loan_digital_closing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_digital_closing_select" ON public.loan_digital_closing;
CREATE POLICY "loan_digital_closing_select"
  ON public.loan_digital_closing FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_digital_closing.loan_id
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

DROP POLICY IF EXISTS "loan_digital_closing_mutate" ON public.loan_digital_closing;
CREATE POLICY "loan_digital_closing_mutate"
  ON public.loan_digital_closing FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_digital_closing.loan_id
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
      WHERE l.id = loan_digital_closing.loan_id
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
-- 5) Adverse action notices (manual generation tracking)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_adverse_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generated', 'mailed', 'delivered', 'cancelled')),
  decision TEXT CHECK (decision IN ('denied', 'withdrawn', 'counteroffer_declined', 'other')),
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  narrative TEXT,
  generated_at TIMESTAMPTZ,
  mailed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_adverse_actions_loan ON public.loan_adverse_actions(loan_id);

ALTER TABLE public.loan_adverse_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_adverse_actions_select" ON public.loan_adverse_actions;
CREATE POLICY "loan_adverse_actions_select"
  ON public.loan_adverse_actions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_adverse_actions.loan_id
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

DROP POLICY IF EXISTS "loan_adverse_actions_mutate" ON public.loan_adverse_actions;
CREATE POLICY "loan_adverse_actions_mutate"
  ON public.loan_adverse_actions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_adverse_actions.loan_id
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
      WHERE l.id = loan_adverse_actions.loan_id
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
