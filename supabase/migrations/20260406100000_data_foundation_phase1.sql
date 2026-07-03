-- Phase 1: Data Foundation
-- Credit reports, employment verifications, and property valuations.
-- Each supports manual entry (always available) and API pull (when integration is active).

-- =============================================================================
-- 1. Credit Reports
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.credit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  -- Source
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'api')),
  provider TEXT, -- e.g. 'experian', 'equifax', 'transunion', 'tri-merge'
  -- Scores
  equifax_score INT,
  experian_score INT,
  transunion_score INT,
  representative_score INT,
  -- Tradeline summary
  total_tradelines INT,
  open_tradelines INT,
  total_monthly_payments DECIMAL(12,2),
  total_revolving_balance DECIMAL(12,2),
  total_installment_balance DECIMAL(12,2),
  collections_count INT DEFAULT 0,
  public_records_count INT DEFAULT 0,
  -- Metadata
  pull_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiration_date TIMESTAMPTZ,
  reference_number TEXT,
  raw_response JSONB,
  notes TEXT,
  -- Audit
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_reports IS 'Credit bureau reports — manual entry or API pull via configured credit provider.';

CREATE INDEX idx_credit_reports_borrower ON public.credit_reports(borrower_id);
CREATE INDEX idx_credit_reports_loan ON public.credit_reports(loan_id);

ALTER TABLE public.credit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_reports_admin_all"
  ON public.credit_reports FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "credit_reports_lo_select"
  ON public.credit_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.borrower_id = credit_reports.borrower_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "credit_reports_lo_insert"
  ON public.credit_reports FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE TRIGGER credit_reports_updated_at
  BEFORE UPDATE ON public.credit_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. Employment Verifications (VOE / VOI)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  -- Source
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'api')),
  provider TEXT, -- e.g. 'the-work-number', 'plaid', 'manual'
  verification_type TEXT NOT NULL DEFAULT 'voe' CHECK (verification_type IN ('voe', 'voi', 'voe_voi')),
  -- Employer
  employer_name TEXT,
  employer_address TEXT,
  employer_phone TEXT,
  job_title TEXT,
  employment_status TEXT CHECK (employment_status IN ('active', 'inactive', 'self_employed', 'retired', 'other')),
  start_date DATE,
  end_date DATE,
  -- Income (VOI)
  annual_income DECIMAL(12,2),
  monthly_income DECIMAL(12,2),
  pay_frequency TEXT CHECK (pay_frequency IN ('weekly', 'biweekly', 'semimonthly', 'monthly', 'annual')),
  ytd_income DECIMAL(12,2),
  -- Verification result
  verified BOOLEAN,
  verification_date TIMESTAMPTZ,
  reference_number TEXT,
  raw_response JSONB,
  notes TEXT,
  -- Audit
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employment_verifications IS 'Employment and income verification — manual entry or API pull via configured VOE/VOI provider.';

CREATE INDEX idx_employment_verifications_borrower ON public.employment_verifications(borrower_id);
CREATE INDEX idx_employment_verifications_loan ON public.employment_verifications(loan_id);

ALTER TABLE public.employment_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employment_verifications_admin_all"
  ON public.employment_verifications FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "employment_verifications_lo_select"
  ON public.employment_verifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.borrower_id = employment_verifications.borrower_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "employment_verifications_lo_insert"
  ON public.employment_verifications FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE TRIGGER employment_verifications_updated_at
  BEFORE UPDATE ON public.employment_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. Property Valuations (AVM)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.property_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES public.borrowers(id) ON DELETE SET NULL,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  -- Source
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'api')),
  provider TEXT, -- e.g. 'clear-capital', 'housecanary', 'corelogic'
  valuation_type TEXT NOT NULL DEFAULT 'avm' CHECK (valuation_type IN ('avm', 'appraisal', 'bpo', 'manual')),
  -- Property
  property_address TEXT,
  property_city TEXT,
  property_state TEXT,
  property_postal_code TEXT,
  property_type TEXT CHECK (property_type IN ('single_family', 'condo', 'townhouse', 'multi_family', '2_4_unit', 'manufactured', 'other')),
  -- Valuation
  estimated_value DECIMAL(15,2),
  low_value DECIMAL(15,2),
  high_value DECIMAL(15,2),
  confidence_score DECIMAL(5,2),
  -- Comparable sales
  comparable_sales JSONB,
  -- Dates
  valuation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiration_date TIMESTAMPTZ,
  reference_number TEXT,
  raw_response JSONB,
  notes TEXT,
  -- Audit
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.property_valuations IS 'Property valuations — AVM (automated), BPO, appraisal, or manual entry.';

CREATE INDEX idx_property_valuations_borrower ON public.property_valuations(borrower_id);
CREATE INDEX idx_property_valuations_loan ON public.property_valuations(loan_id);

ALTER TABLE public.property_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_valuations_admin_all"
  ON public.property_valuations FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "property_valuations_lo_select"
  ON public.property_valuations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE (l.borrower_id = property_valuations.borrower_id OR l.id = property_valuations.loan_id)
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "property_valuations_lo_insert"
  ON public.property_valuations FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE TRIGGER property_valuations_updated_at
  BEFORE UPDATE ON public.property_valuations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. Seed integration_settings display names for new providers
-- =============================================================================
DO $$
BEGIN
  -- Add display name mapping awareness for useIntegrationSettings hook
  -- (actual rows are created on-demand when admin configures them)
  RAISE NOTICE 'Phase 1 Data Foundation tables created: credit_reports, employment_verifications, property_valuations';
END;
$$;
