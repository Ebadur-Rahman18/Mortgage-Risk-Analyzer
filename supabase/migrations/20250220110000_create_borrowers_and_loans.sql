-- Borrowers and Loans tables.
-- Schema supports manual entry and third-party sync (e.g. Fannie Mae ULDD, credit bureau).
-- Field names align with common GSE/API usage where applicable.

-- =============================================================================
-- 1. Borrowers
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity (manual or API)
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  -- GSE/credit bureau compatible (optional; can be filled by API or manual)
  ssn_last4 VARCHAR(4),
  date_of_birth DATE,
  -- Address
  street_address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  -- Source: manual entry vs API sync
  data_source VARCHAR(50) DEFAULT 'manual',
  external_id VARCHAR(255),
  api_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.borrowers IS 'Borrowers; supports manual entry and third-party API sync (e.g. credit bureau).';
COMMENT ON COLUMN public.borrowers.data_source IS 'manual | fannie_mae | credit_bureau | etc.';
COMMENT ON COLUMN public.borrowers.external_id IS 'ID from external system for sync deduplication.';
COMMENT ON COLUMN public.borrowers.api_payload IS 'Raw or normalized payload from API for audit/future mapping.';

CREATE INDEX IF NOT EXISTS idx_borrowers_external_id ON public.borrowers(external_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_created_by ON public.borrowers(created_by);

-- =============================================================================
-- 2. Loans (links to loan_products, loan_programs, borrowers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number VARCHAR(50) NOT NULL UNIQUE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE RESTRICT,
  loan_officer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES public.loan_products(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.loan_programs(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  -- Amounts (GSE/API compatible)
  loan_amount DECIMAL(15,2),
  appraised_value DECIMAL(15,2),
  ltv DECIMAL(5,2),
  -- Eligibility / credit (credit bureau compatible)
  credit_score INT,
  dti DECIMAL(5,2),
  -- Loan purpose and occupancy (ULDD-style)
  purpose VARCHAR(50),
  occupancy_type VARCHAR(50),
  -- Property (optional; can be extended)
  property_address VARCHAR(255),
  property_city VARCHAR(100),
  property_state VARCHAR(50),
  property_postal_code VARCHAR(20),
  -- Dates
  lock_date DATE,
  lock_expiration_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Sync support
  data_source VARCHAR(50) DEFAULT 'manual',
  external_id VARCHAR(255),
  api_payload JSONB
);

COMMENT ON TABLE public.loans IS 'Loan applications; supports manual entry and third-party sync (e.g. Fannie Mae, credit bureau).';
COMMENT ON COLUMN public.loans.purpose IS 'Purchase | Refinance | etc. (ULDD-style).';
COMMENT ON COLUMN public.loans.occupancy_type IS 'Primary | SecondHome | Investment.';
COMMENT ON COLUMN public.loans.data_source IS 'manual | fannie_mae | credit_bureau | etc.';
COMMENT ON COLUMN public.loans.api_payload IS 'Extra fields or raw API response for sync.';

CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_loan_officer_id ON public.loans(loan_officer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_external_id ON public.loans(external_id);

-- updated_at triggers
CREATE TRIGGER borrowers_updated_at
  BEFORE UPDATE ON public.borrowers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. RLS
-- =============================================================================
ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "borrowers_admin_all"
  ON public.borrowers FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "loans_admin_all"
  ON public.loans FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Loan officers: see/create/update their own loans and related borrowers
CREATE POLICY "borrowers_loan_officer_select"
  ON public.borrowers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.borrower_id = borrowers.id AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "borrowers_loan_officer_insert"
  ON public.borrowers FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "borrowers_loan_officer_update"
  ON public.borrowers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.borrower_id = borrowers.id AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (true);

CREATE POLICY "loans_loan_officer_select"
  ON public.loans FOR SELECT
  TO authenticated
  USING (loan_officer_id = auth.uid());

CREATE POLICY "loans_loan_officer_insert"
  ON public.loans FOR INSERT
  TO authenticated
  WITH CHECK (loan_officer_id = auth.uid() AND (created_by = auth.uid() OR created_by IS NULL));

CREATE POLICY "loans_loan_officer_update"
  ON public.loans FOR UPDATE
  TO authenticated
  USING (loan_officer_id = auth.uid())
  WITH CHECK (loan_officer_id = auth.uid());
