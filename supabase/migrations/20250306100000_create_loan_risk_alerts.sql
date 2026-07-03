-- In-app risk and SLA alerts, scoped by role via loan ownership / branch.
-- Created by calculate-loan-risk edge function; read by all roles (filtered by RLS).

CREATE TABLE IF NOT EXISTS public.loan_risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_risk_alerts IS 'Risk and SLA alerts for loans. Written by edge functions; read by all roles filtered by loan ownership/branch.';
COMMENT ON COLUMN public.loan_risk_alerts.alert_type IS 'lock_expiry | high_risk | critical_risk | sla_warning | sla_breach | condition_overdue | stall';
COMMENT ON COLUMN public.loan_risk_alerts.severity IS 'low | medium | high | critical';

CREATE INDEX IF NOT EXISTS idx_risk_alerts_loan_id ON public.loan_risk_alerts(loan_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_type ON public.loan_risk_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_read ON public.loan_risk_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_created ON public.loan_risk_alerts(created_at DESC);

ALTER TABLE public.loan_risk_alerts ENABLE ROW LEVEL SECURITY;

-- Idempotency: if a previous push partially applied this migration,
-- re-running should not fail on duplicate policy names.
DROP POLICY IF EXISTS "risk_alerts_admin_all" ON public.loan_risk_alerts;
DROP POLICY IF EXISTS "risk_alerts_branch_manager_select" ON public.loan_risk_alerts;
DROP POLICY IF EXISTS "risk_alerts_branch_manager_update" ON public.loan_risk_alerts;
DROP POLICY IF EXISTS "risk_alerts_loan_officer_select" ON public.loan_risk_alerts;
DROP POLICY IF EXISTS "risk_alerts_loan_officer_update" ON public.loan_risk_alerts;

-- Admin: full access
CREATE POLICY "risk_alerts_admin_all"
  ON public.loan_risk_alerts FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Branch Manager: read alerts for loans in their branch
CREATE POLICY "risk_alerts_branch_manager_select"
  ON public.loan_risk_alerts FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_alerts.loan_id
      AND l.branch_id IS NOT NULL
      AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Branch Manager: can mark as read / dismiss
CREATE POLICY "risk_alerts_branch_manager_update"
  ON public.loan_risk_alerts FOR UPDATE
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_alerts.loan_id
      AND l.branch_id IS NOT NULL
      AND l.branch_id = public.user_branch_id(auth.uid())
    )
  )
  WITH CHECK (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_alerts.loan_id
      AND l.branch_id IS NOT NULL
      AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Loan Officer: read + update alerts for their own loans
CREATE POLICY "risk_alerts_loan_officer_select"
  ON public.loan_risk_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_alerts.loan_id AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "risk_alerts_loan_officer_update"
  ON public.loan_risk_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_alerts.loan_id AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_alerts.loan_id AND l.loan_officer_id = auth.uid()
    )
  );
