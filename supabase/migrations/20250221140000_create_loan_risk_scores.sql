-- AI-calculated risk scores per loan.
-- Written by backend edge functions (service role); read-only for users.

CREATE TABLE IF NOT EXISTS public.loan_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  overall_risk_score INT NOT NULL DEFAULT 0
    CHECK (overall_risk_score BETWEEN 0 AND 100),
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  stall_risk INT DEFAULT 0
    CHECK (stall_risk IS NULL OR stall_risk BETWEEN 0 AND 100),
  lock_expiry_risk INT DEFAULT 0
    CHECK (lock_expiry_risk IS NULL OR lock_expiry_risk BETWEEN 0 AND 100),
  condition_risk INT DEFAULT 0
    CHECK (condition_risk IS NULL OR condition_risk BETWEEN 0 AND 100),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_risk_scores IS 'AI/system-calculated risk scores. Written by edge functions (service role); users are read-only.';
COMMENT ON COLUMN public.loan_risk_scores.risk_level IS 'low | medium | high | critical';
COMMENT ON COLUMN public.loan_risk_scores.risk_factors IS 'JSON array of risk factor objects, e.g. [{"type":"lock_expiry","description":"Lock expires in 5 days","weight":30}]';
COMMENT ON COLUMN public.loan_risk_scores.stall_risk IS '0-100 sub-score for stalled-pipeline risk.';
COMMENT ON COLUMN public.loan_risk_scores.lock_expiry_risk IS '0-100 sub-score for rate-lock expiration risk.';
COMMENT ON COLUMN public.loan_risk_scores.condition_risk IS '0-100 sub-score for outstanding-conditions risk.';

CREATE INDEX IF NOT EXISTS idx_risk_scores_loan_id ON public.loan_risk_scores(loan_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_level ON public.loan_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_scores_calculated ON public.loan_risk_scores(calculated_at);

DROP TRIGGER IF EXISTS loan_risk_scores_updated_at ON public.loan_risk_scores;
CREATE TRIGGER loan_risk_scores_updated_at
  BEFORE UPDATE ON public.loan_risk_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.loan_risk_scores ENABLE ROW LEVEL SECURITY;

-- Admin: full access (read + manual override if needed)
DROP POLICY IF EXISTS "risk_scores_admin_all" ON public.loan_risk_scores;
CREATE POLICY "risk_scores_admin_all"
  ON public.loan_risk_scores FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Branch Manager: read risk scores for loans in their branch
DROP POLICY IF EXISTS "risk_scores_branch_manager_select" ON public.loan_risk_scores;
CREATE POLICY "risk_scores_branch_manager_select"
  ON public.loan_risk_scores FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_scores.loan_id
      AND l.branch_id IS NOT NULL
      AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Loan Officer: read risk scores for their own loans
DROP POLICY IF EXISTS "risk_scores_loan_officer_select" ON public.loan_risk_scores;
CREATE POLICY "risk_scores_loan_officer_select"
  ON public.loan_risk_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_scores.loan_id AND l.loan_officer_id = auth.uid()
    )
  );
