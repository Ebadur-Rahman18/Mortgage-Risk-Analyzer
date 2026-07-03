-- Loan milestones: key dates/stages in the loan lifecycle.

CREATE TABLE IF NOT EXISTS public.loan_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  milestone_type VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  external_id VARCHAR(255),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_milestones IS 'Key dates/stages in the loan lifecycle.';
COMMENT ON COLUMN public.loan_milestones.milestone_type IS 'application_received | submitted_to_uw | conditional_approval | clear_to_close | docs_out | funding | closed';
COMMENT ON COLUMN public.loan_milestones.external_id IS 'ID from LOS for sync deduplication.';

CREATE INDEX IF NOT EXISTS idx_milestones_loan_id ON public.loan_milestones(loan_id);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON public.loan_milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_milestones_completed ON public.loan_milestones(completed_at);

DROP TRIGGER IF EXISTS loan_milestones_updated_at ON public.loan_milestones;
CREATE TRIGGER loan_milestones_updated_at
  BEFORE UPDATE ON public.loan_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.loan_milestones ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DROP POLICY IF EXISTS "milestones_admin_all" ON public.loan_milestones;
CREATE POLICY "milestones_admin_all"
  ON public.loan_milestones FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Branch Manager: read milestones for loans in their branch
DROP POLICY IF EXISTS "milestones_branch_manager_select" ON public.loan_milestones;
CREATE POLICY "milestones_branch_manager_select"
  ON public.loan_milestones FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_milestones.loan_id
      AND l.branch_id IS NOT NULL
      AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Loan Officer: read milestones for their own loans
DROP POLICY IF EXISTS "milestones_loan_officer_select" ON public.loan_milestones;
CREATE POLICY "milestones_loan_officer_select"
  ON public.loan_milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_milestones.loan_id AND l.loan_officer_id = auth.uid()
    )
  );

-- Loan Officer: create milestones for their own loans
DROP POLICY IF EXISTS "milestones_loan_officer_insert" ON public.loan_milestones;
CREATE POLICY "milestones_loan_officer_insert"
  ON public.loan_milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id AND l.loan_officer_id = auth.uid()
    )
  );

-- Loan Officer: update milestones on their own loans
DROP POLICY IF EXISTS "milestones_loan_officer_update" ON public.loan_milestones;
CREATE POLICY "milestones_loan_officer_update"
  ON public.loan_milestones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_milestones.loan_id AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (true);
