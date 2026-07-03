-- Pricing & Rate Lock Module – Core Schema, RLS, and Module Toggle
-- Idempotent migration: safe to run multiple times.
-- Relies on existing helpers: public.has_role, public.is_branch_manager, public.user_branch_id, public.set_updated_at.

-- =============================================================================
-- 1. Core Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'datastore')),
  effective_date DATE,
  expiration_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  datastore_source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.rate_sheets IS 'Pricing rate sheets ingested via upload or datastore.';
COMMENT ON COLUMN public.rate_sheets.source_type IS 'upload | datastore';
COMMENT ON COLUMN public.rate_sheets.status IS 'active | archived';

CREATE INDEX IF NOT EXISTS idx_rate_sheets_status ON public.rate_sheets(status);
CREATE INDEX IF NOT EXISTS idx_rate_sheets_effective_date ON public.rate_sheets(effective_date);
CREATE INDEX IF NOT EXISTS idx_rate_sheets_expiration_date ON public.rate_sheets(expiration_date);

CREATE TABLE IF NOT EXISTS public.rate_sheet_datastores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('csv_import', 'external_tool')),
  integration_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')) DEFAULT 'active'
);

COMMENT ON TABLE public.rate_sheet_datastores IS 'External or internal pricing datastores used to populate rate sheets.';
COMMENT ON COLUMN public.rate_sheet_datastores.connection_type IS 'csv_import | external_tool';

CREATE INDEX IF NOT EXISTS idx_rate_sheet_datastores_status ON public.rate_sheet_datastores(status);

-- rate_sheets.datastore_source_id FK may reference rate_sheet_datastores; ensure constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rate_sheets_datastore_source_id_fkey'
      AND table_name = 'rate_sheets' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.rate_sheets
      ADD CONSTRAINT rate_sheets_datastore_source_id_fkey
      FOREIGN KEY (datastore_source_id) REFERENCES public.rate_sheet_datastores(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.rate_sheet_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id UUID NOT NULL REFERENCES public.rate_sheets(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  loan_type TEXT,
  min_credit_score INT,
  max_ltv NUMERIC(5,2),
  min_loan_amount NUMERIC(15,2),
  max_loan_amount NUMERIC(15,2),
  state TEXT NOT NULL,
  rate NUMERIC(6,4) NOT NULL,
  price NUMERIC(8,4),
  points NUMERIC(8,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rate_sheet_products IS 'Per-product pricing rows belonging to a rate sheet.';

CREATE INDEX IF NOT EXISTS idx_rate_sheet_products_sheet_id ON public.rate_sheet_products(rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_products_product_state ON public.rate_sheet_products(product_name, state);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_products_credit_ltv ON public.rate_sheet_products(min_credit_score, max_ltv);

CREATE TABLE IF NOT EXISTS public.product_eligibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  min_fico INT,
  max_ltv NUMERIC(5,2),
  allowed_states TEXT[],
  min_loan_amount NUMERIC(15,2),
  max_loan_amount NUMERIC(15,2),
  additional_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_eligibility_rules IS 'Eligibility rules per product, used by pricing engine.';

CREATE TABLE IF NOT EXISTS public.loan_pricing_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  loan_amount NUMERIC(15,2),
  property_value NUMERIC(15,2),
  ltv NUMERIC(5,2),
  credit_score INT,
  state TEXT,
  product_selected TEXT,
  lock_term_days INT,
  calculated_rate NUMERIC(6,4),
  calculated_price NUMERIC(8,4),
  eligibility_status TEXT,
  conditions_text TEXT,
  raw_match_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_pricing_calculations IS 'Audit trail of each pricing calculator run.';

CREATE INDEX IF NOT EXISTS idx_loan_pricing_calculations_user_created
  ON public.loan_pricing_calculations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rate_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  product_name TEXT,
  locked_rate NUMERIC(6,4),
  lock_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lock_expiration DATE NOT NULL,
  lock_term_days INT,
  locked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'extended', 'relocked')) DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rate_locks IS 'Rate locks tied to loans, including current status and terms.';
COMMENT ON COLUMN public.rate_locks.status IS 'active | expired | extended | relocked';

CREATE INDEX IF NOT EXISTS idx_rate_locks_loan_id ON public.rate_locks(loan_id);
CREATE INDEX IF NOT EXISTS idx_rate_locks_status ON public.rate_locks(status);
CREATE INDEX IF NOT EXISTS idx_rate_locks_lock_expiration ON public.rate_locks(lock_expiration);
CREATE INDEX IF NOT EXISTS idx_rate_locks_branch_id ON public.rate_locks(branch_id);

CREATE TABLE IF NOT EXISTS public.rate_lock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_lock_id UUID NOT NULL REFERENCES public.rate_locks(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('lock', 'relock', 'extension')),
  previous_rate NUMERIC(6,4),
  new_rate NUMERIC(6,4),
  extension_days INT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.rate_lock_history IS 'History of rate lock actions (lock, extension, relock) for audit.';

CREATE TABLE IF NOT EXISTS public.lock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_lock_id UUID NOT NULL REFERENCES public.rate_locks(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  alert_date DATE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  sent BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lock_alerts IS 'Lock expiry alerts for loans, scoped by loan ownership and branch.';
COMMENT ON COLUMN public.lock_alerts.alert_type IS 'expiring_3_days | expiring_tomorrow | expired';

CREATE INDEX IF NOT EXISTS idx_lock_alerts_loan_id ON public.lock_alerts(loan_id);
CREATE INDEX IF NOT EXISTS idx_lock_alerts_type_date_sent ON public.lock_alerts(alert_type, alert_date, sent);
CREATE INDEX IF NOT EXISTS idx_lock_alerts_read ON public.lock_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_lock_alerts_created ON public.lock_alerts(created_at DESC);

-- =============================================================================
-- 2. Row Level Security
-- =============================================================================

ALTER TABLE public.rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_sheet_datastores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_sheet_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_pricing_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_lock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lock_alerts ENABLE ROW LEVEL SECURITY;

-- Idempotently drop existing policies so re-runs do not fail
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE tablename = 'rate_sheets';
  IF FOUND THEN
    DROP POLICY IF EXISTS "rate_sheets_select_all" ON public.rate_sheets;
    DROP POLICY IF EXISTS "rate_sheets_admin_all" ON public.rate_sheets;
  END IF;

  PERFORM 1 FROM pg_policies WHERE tablename = 'rate_sheet_datastores';
  IF FOUND THEN
    DROP POLICY IF EXISTS "rate_sheet_datastores_admin_all" ON public.rate_sheet_datastores;
    DROP POLICY IF EXISTS "rate_sheet_datastores_select_all" ON public.rate_sheet_datastores;
  END IF;

  PERFORM 1 FROM pg_policies WHERE tablename = 'rate_sheet_products';
  IF FOUND THEN
    DROP POLICY IF EXISTS "rate_sheet_products_select_all" ON public.rate_sheet_products;
  END IF;

  PERFORM 1 FROM pg_policies WHERE tablename = 'product_eligibility_rules';
  IF FOUND THEN
    DROP POLICY IF EXISTS "product_eligibility_rules_select_all" ON public.product_eligibility_rules;
    DROP POLICY IF EXISTS "product_eligibility_rules_admin_all" ON public.product_eligibility_rules;
  END IF;

  PERFORM 1 FROM pg_policies WHERE tablename = 'loan_pricing_calculations';
  IF FOUND THEN
    DROP POLICY IF EXISTS "loan_pricing_calculations_select_own" ON public.loan_pricing_calculations;
    DROP POLICY IF EXISTS "loan_pricing_calculations_admin_all" ON public.loan_pricing_calculations;
    DROP POLICY IF EXISTS "loan_pricing_calculations_insert_authenticated" ON public.loan_pricing_calculations;
  END IF;

  PERFORM 1 FROM pg_policies WHERE tablename = 'rate_locks';
  IF FOUND THEN
    DROP POLICY IF EXISTS "rate_locks_admin_all" ON public.rate_locks;
    DROP POLICY IF EXISTS "rate_locks_branch_manager_select" ON public.rate_locks;
    DROP POLICY IF EXISTS "rate_locks_branch_manager_update" ON public.rate_locks;
    DROP POLICY IF EXISTS "rate_locks_loan_officer_select" ON public.rate_locks;
    DROP POLICY IF EXISTS "rate_locks_loan_officer_update" ON public.rate_locks;
  END IF;

  PERFORM 1 FROM pg_policies WHERE tablename = 'rate_lock_history';
  IF FOUND THEN
    DROP POLICY IF EXISTS "rate_lock_history_admin_all" ON public.rate_lock_history;
    DROP POLICY IF EXISTS "rate_lock_history_branch_manager_select" ON public.rate_lock_history;
    DROP POLICY IF EXISTS "rate_lock_history_loan_officer_select" ON public.rate_lock_history;
  END IF;

  PERFORM 1 FROM pg_policies WHERE tablename = 'lock_alerts';
  IF FOUND THEN
    DROP POLICY IF EXISTS "lock_alerts_admin_all" ON public.lock_alerts;
    DROP POLICY IF EXISTS "lock_alerts_branch_manager_select" ON public.lock_alerts;
    DROP POLICY IF EXISTS "lock_alerts_branch_manager_update" ON public.lock_alerts;
    DROP POLICY IF EXISTS "lock_alerts_loan_officer_select" ON public.lock_alerts;
    DROP POLICY IF EXISTS "lock_alerts_loan_officer_update" ON public.lock_alerts;
  END IF;
END;
$$;

-- Rate sheets: read for all authenticated, write for admins
CREATE POLICY "rate_sheets_select_all"
  ON public.rate_sheets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rate_sheets_admin_all"
  ON public.rate_sheets FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Datastores: admin-only write, optional read
CREATE POLICY "rate_sheet_datastores_select_all"
  ON public.rate_sheet_datastores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rate_sheet_datastores_admin_all"
  ON public.rate_sheet_datastores FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Products and eligibility: readable by all authenticated, admin-only write
CREATE POLICY "rate_sheet_products_select_all"
  ON public.rate_sheet_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_eligibility_rules_select_all"
  ON public.product_eligibility_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_eligibility_rules_admin_all"
  ON public.product_eligibility_rules FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Pricing calculations: users see their own, admins see all; all authenticated may insert
CREATE POLICY "loan_pricing_calculations_select_own"
  ON public.loan_pricing_calculations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role('admin'::public.app_role, auth.uid())
  );

CREATE POLICY "loan_pricing_calculations_insert_authenticated"
  ON public.loan_pricing_calculations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "loan_pricing_calculations_admin_all"
  ON public.loan_pricing_calculations FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Rate locks and history: follow loans / branch / LO patterns
CREATE POLICY "rate_locks_admin_all"
  ON public.rate_locks FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "rate_locks_branch_manager_select"
  ON public.rate_locks FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND branch_id IS NOT NULL
    AND branch_id = public.user_branch_id(auth.uid())
  );

CREATE POLICY "rate_locks_branch_manager_update"
  ON public.rate_locks FOR UPDATE
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND branch_id IS NOT NULL
    AND branch_id = public.user_branch_id(auth.uid())
  )
  WITH CHECK (
    public.is_branch_manager(auth.uid())
    AND branch_id IS NOT NULL
    AND branch_id = public.user_branch_id(auth.uid())
  );

CREATE POLICY "rate_locks_loan_officer_select"
  ON public.rate_locks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = rate_locks.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "rate_locks_loan_officer_update"
  ON public.rate_locks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = rate_locks.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = rate_locks.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "rate_lock_history_admin_all"
  ON public.rate_lock_history FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "rate_lock_history_branch_manager_select"
  ON public.rate_lock_history FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = rate_lock_history.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

CREATE POLICY "rate_lock_history_loan_officer_select"
  ON public.rate_lock_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = rate_lock_history.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

-- Lock alerts: mirror loan_risk_alerts patterns
CREATE POLICY "lock_alerts_admin_all"
  ON public.lock_alerts FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "lock_alerts_branch_manager_select"
  ON public.lock_alerts FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = lock_alerts.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

CREATE POLICY "lock_alerts_branch_manager_update"
  ON public.lock_alerts FOR UPDATE
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = lock_alerts.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  )
  WITH CHECK (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = lock_alerts.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

CREATE POLICY "lock_alerts_loan_officer_select"
  ON public.lock_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = lock_alerts.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "lock_alerts_loan_officer_update"
  ON public.lock_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = lock_alerts.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = lock_alerts.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. Module Settings Seed
-- =============================================================================

INSERT INTO public.module_settings (slug, name, description, enabled, display_order)
VALUES
  (
    'pricing_lock',
    'Pricing & Rate Lock',
    'Pricing engine, product eligibility, and rate lock tracking integrated with Loans.',
    false,
    20
  )
ON CONFLICT (slug) DO NOTHING;

