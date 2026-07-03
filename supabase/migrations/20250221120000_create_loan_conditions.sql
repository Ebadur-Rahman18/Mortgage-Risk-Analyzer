-- Underwriting conditions: PTD, PTF, PTC tracking per loan.
-- The ConditionTracker UI component will read from this table.

CREATE TABLE IF NOT EXISTS public.loan_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  condition_type VARCHAR(20) NOT NULL,
  category VARCHAR(100),
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  due_date DATE,
  received_at TIMESTAMPTZ,
  notes TEXT,
  external_id VARCHAR(255),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_conditions IS 'Underwriting conditions that must be satisfied before approval/funding/closing.';
COMMENT ON COLUMN public.loan_conditions.condition_type IS 'PTD (Prior to Doc) | PTF (Prior to Funding) | PTC (Prior to Close)';
COMMENT ON COLUMN public.loan_conditions.status IS 'pending | received | waived | expired | cleared';
COMMENT ON COLUMN public.loan_conditions.external_id IS 'ID from LOS for sync deduplication.';

CREATE INDEX IF NOT EXISTS idx_conditions_loan_id ON public.loan_conditions(loan_id);
CREATE INDEX IF NOT EXISTS idx_conditions_status ON public.loan_conditions(status);
CREATE INDEX IF NOT EXISTS idx_conditions_type ON public.loan_conditions(condition_type);

DROP TRIGGER IF EXISTS loan_conditions_updated_at ON public.loan_conditions;
CREATE TRIGGER loan_conditions_updated_at
  BEFORE UPDATE ON public.loan_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.loan_conditions ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DROP POLICY IF EXISTS "conditions_admin_all" ON public.loan_conditions;
CREATE POLICY "conditions_admin_all"
  ON public.loan_conditions FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Branch Manager: read conditions for loans in their branch
DROP POLICY IF EXISTS "conditions_branch_manager_select" ON public.loan_conditions;
CREATE POLICY "conditions_branch_manager_select"
  ON public.loan_conditions FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_conditions.loan_id
      AND l.branch_id IS NOT NULL
      AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Loan Officer: read conditions for their own loans
DROP POLICY IF EXISTS "conditions_loan_officer_select" ON public.loan_conditions;
CREATE POLICY "conditions_loan_officer_select"
  ON public.loan_conditions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_conditions.loan_id AND l.loan_officer_id = auth.uid()
    )
  );

-- Loan Officer: create conditions for their own loans
DROP POLICY IF EXISTS "conditions_loan_officer_insert" ON public.loan_conditions;
CREATE POLICY "conditions_loan_officer_insert"
  ON public.loan_conditions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id AND l.loan_officer_id = auth.uid()
    )
  );

-- Loan Officer: update conditions on their own loans
DROP POLICY IF EXISTS "conditions_loan_officer_update" ON public.loan_conditions;
CREATE POLICY "conditions_loan_officer_update"
  ON public.loan_conditions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_conditions.loan_id AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (true);
