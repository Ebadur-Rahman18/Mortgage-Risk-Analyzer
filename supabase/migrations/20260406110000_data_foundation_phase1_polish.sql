-- Phase 1 polish: LO update/delete policies, consent tracking, dedup guard

-- =============================================================================
-- 1. LO UPDATE + DELETE policies on Phase 1 tables
-- =============================================================================

-- Credit reports
CREATE POLICY "credit_reports_lo_update"
  ON public.credit_reports FOR UPDATE TO authenticated
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "credit_reports_lo_delete"
  ON public.credit_reports FOR DELETE TO authenticated
  USING (requested_by = auth.uid());

-- Employment verifications
CREATE POLICY "employment_verifications_lo_update"
  ON public.employment_verifications FOR UPDATE TO authenticated
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "employment_verifications_lo_delete"
  ON public.employment_verifications FOR DELETE TO authenticated
  USING (requested_by = auth.uid());

-- Property valuations
CREATE POLICY "property_valuations_lo_update"
  ON public.property_valuations FOR UPDATE TO authenticated
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "property_valuations_lo_delete"
  ON public.property_valuations FOR DELETE TO authenticated
  USING (requested_by = auth.uid());

-- =============================================================================
-- 2. Borrower credit consent tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.borrower_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('credit_pull', 'voe_voi', 'avm')),
  consented BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMPTZ,
  consented_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  method TEXT NOT NULL DEFAULT 'in_app' CHECK (method IN ('in_app', 'written', 'verbal', 'esign')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.borrower_consents IS 'Tracks borrower authorization for credit pulls, employment verification, and property valuation requests.';

CREATE INDEX idx_borrower_consents_borrower ON public.borrower_consents(borrower_id);
CREATE INDEX idx_borrower_consents_loan ON public.borrower_consents(loan_id);
CREATE UNIQUE INDEX idx_borrower_consents_unique
  ON public.borrower_consents(borrower_id, loan_id, consent_type)
  WHERE consented = true;

ALTER TABLE public.borrower_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "borrower_consents_admin_all"
  ON public.borrower_consents FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "borrower_consents_lo_select"
  ON public.borrower_consents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.borrower_id = borrower_consents.borrower_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "borrower_consents_lo_insert"
  ON public.borrower_consents FOR INSERT TO authenticated
  WITH CHECK (consented_by = auth.uid());

CREATE POLICY "borrower_consents_lo_update"
  ON public.borrower_consents FOR UPDATE TO authenticated
  USING (consented_by = auth.uid())
  WITH CHECK (consented_by = auth.uid());

CREATE TRIGGER borrower_consents_updated_at
  BEFORE UPDATE ON public.borrower_consents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
