-- =============================================================================
-- Phase 2: Core Origination
-- Extends LOS, adds DMS, enhances Product & Eligibility Engine
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. LOAN STATUS MODEL
-- ─────────────────────────────────────────────────────────────────────────────

-- Add underwriter_id to loans
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS underwriter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loans_underwriter_id ON public.loans(underwriter_id);

-- Underwriter can read assigned loans
DROP POLICY IF EXISTS "loans_underwriter_select" ON public.loans;
CREATE POLICY "loans_underwriter_select"
  ON public.loans FOR SELECT
  TO authenticated
  USING (underwriter_id = auth.uid());

-- Underwriter can update assigned loans
DROP POLICY IF EXISTS "loans_underwriter_update" ON public.loans;
CREATE POLICY "loans_underwriter_update"
  ON public.loans FOR UPDATE
  TO authenticated
  USING (underwriter_id = auth.uid())
  WITH CHECK (underwriter_id = auth.uid());

-- Stage transition rules (state machine definition)
CREATE TABLE IF NOT EXISTS public.loan_stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status VARCHAR(50) NOT NULL,
  to_status VARCHAR(50) NOT NULL,
  required_role VARCHAR(50),
  label VARCHAR(100),
  auto_milestone VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_status, to_status)
);

COMMENT ON TABLE public.loan_stage_transitions IS 'Valid loan status transitions with role gates.';
COMMENT ON COLUMN public.loan_stage_transitions.required_role IS 'Role required: admin, loan_officer, underwriter, processor. NULL = any.';
COMMENT ON COLUMN public.loan_stage_transitions.auto_milestone IS 'Milestone type to auto-create on transition.';

ALTER TABLE public.loan_stage_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_transitions_select_all" ON public.loan_stage_transitions;
CREATE POLICY "stage_transitions_select_all"
  ON public.loan_stage_transitions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "stage_transitions_admin_all" ON public.loan_stage_transitions;
CREATE POLICY "stage_transitions_admin_all"
  ON public.loan_stage_transitions FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Seed valid transitions
INSERT INTO public.loan_stage_transitions (from_status, to_status, required_role, label, auto_milestone) VALUES
  ('draft', 'application', 'loan_officer', 'Submit Application', 'application_received'),
  ('application', 'submitted', 'loan_officer', 'Submit to Processing', 'submitted_to_processing'),
  ('submitted', 'processing', NULL, 'Begin Processing', NULL),
  ('processing', 'underwriting', NULL, 'Send to Underwriting', 'submitted_to_uw'),
  ('underwriting', 'conditional_approval', 'underwriter', 'Conditional Approval', 'conditional_approval'),
  ('underwriting', 'denied', 'underwriter', 'Deny Loan', NULL),
  ('underwriting', 'suspended', 'underwriter', 'Suspend Review', NULL),
  ('suspended', 'underwriting', 'underwriter', 'Resume Review', NULL),
  ('conditional_approval', 'clear_to_close', 'underwriter', 'Clear to Close', 'clear_to_close'),
  ('clear_to_close', 'docs_out', NULL, 'Documents Out', 'docs_out'),
  ('docs_out', 'funding', NULL, 'Fund Loan', 'funding'),
  ('funding', 'closed', NULL, 'Close Loan', 'closed'),
  -- Allow withdrawal from most states
  ('application', 'withdrawn', NULL, 'Withdraw', NULL),
  ('submitted', 'withdrawn', NULL, 'Withdraw', NULL),
  ('processing', 'withdrawn', NULL, 'Withdraw', NULL),
  ('underwriting', 'withdrawn', NULL, 'Withdraw', NULL),
  ('conditional_approval', 'withdrawn', NULL, 'Withdraw', NULL)
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Auto-create timeline event on loan status change
CREATE OR REPLACE FUNCTION public.loan_status_change_timeline()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.loan_timeline_events (loan_id, event_type, event_source, title, description, metadata)
    VALUES (
      NEW.id,
      'status_change',
      'system',
      'Status changed to ' || NEW.status,
      'Loan status changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status,
      jsonb_build_object('from_status', OLD.status, 'to_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS loan_status_change_timeline_trigger ON public.loans;
CREATE TRIGGER loan_status_change_timeline_trigger
  AFTER UPDATE ON public.loans
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.loan_status_change_timeline();

-- ─────────────────────────────────────────────────────────────────────────────
-- B. 1003-STYLE APPLICATION DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- B1. Borrower assets
CREATE TABLE IF NOT EXISTS public.loan_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL,
  institution VARCHAR(200),
  account_number VARCHAR(100),
  balance DECIMAL(15,2),
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_assets IS 'Borrower assets for loan qualification (1003 Section V).';
COMMENT ON COLUMN public.loan_assets.asset_type IS 'checking | savings | investment | retirement | gift | other';

CREATE INDEX IF NOT EXISTS idx_loan_assets_loan_id ON public.loan_assets(loan_id);

DROP TRIGGER IF EXISTS loan_assets_updated_at ON public.loan_assets;
CREATE TRIGGER loan_assets_updated_at
  BEFORE UPDATE ON public.loan_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- B2. Borrower liabilities
CREATE TABLE IF NOT EXISTS public.loan_liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  liability_type VARCHAR(50) NOT NULL,
  creditor VARCHAR(200),
  account_number VARCHAR(100),
  monthly_payment DECIMAL(12,2),
  unpaid_balance DECIMAL(15,2),
  months_remaining INT,
  to_be_paid_off BOOLEAN DEFAULT false,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_liabilities IS 'Borrower liabilities for DTI (1003 Section VI).';
COMMENT ON COLUMN public.loan_liabilities.liability_type IS 'mortgage | auto_loan | student_loan | credit_card | personal_loan | other';

CREATE INDEX IF NOT EXISTS idx_loan_liabilities_loan_id ON public.loan_liabilities(loan_id);

DROP TRIGGER IF EXISTS loan_liabilities_updated_at ON public.loan_liabilities;
CREATE TRIGGER loan_liabilities_updated_at
  BEFORE UPDATE ON public.loan_liabilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- B3. Real estate owned (REO)
CREATE TABLE IF NOT EXISTS public.loan_reo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  property_address VARCHAR(255) NOT NULL,
  property_city VARCHAR(100),
  property_state VARCHAR(50),
  property_postal_code VARCHAR(20),
  property_type VARCHAR(50),
  market_value DECIMAL(15,2),
  mortgage_balance DECIMAL(15,2),
  monthly_mortgage DECIMAL(12,2),
  rental_income DECIMAL(12,2),
  status VARCHAR(30) DEFAULT 'retained',
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_reo IS 'Borrower real estate owned (1003 Section V).';
COMMENT ON COLUMN public.loan_reo.status IS 'retained | sold | pending_sale';

CREATE INDEX IF NOT EXISTS idx_loan_reo_loan_id ON public.loan_reo(loan_id);

DROP TRIGGER IF EXISTS loan_reo_updated_at ON public.loan_reo;
CREATE TRIGGER loan_reo_updated_at
  BEFORE UPDATE ON public.loan_reo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- B4. Declarations
CREATE TABLE IF NOT EXISTS public.loan_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  declarations JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(loan_id, borrower_id)
);

COMMENT ON TABLE public.loan_declarations IS 'Borrower declarations (1003 Section VIII). JSONB keys match standard questions.';

CREATE INDEX IF NOT EXISTS idx_loan_declarations_loan_id ON public.loan_declarations(loan_id);

DROP TRIGGER IF EXISTS loan_declarations_updated_at ON public.loan_declarations;
CREATE TRIGGER loan_declarations_updated_at
  BEFORE UPDATE ON public.loan_declarations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS for 1003 tables (same pattern as conditions/milestones)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['loan_assets', 'loan_liabilities', 'loan_reo', 'loan_declarations'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_admin_all" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_lo_select" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_lo_insert" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_lo_update" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_lo_delete" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_uw_select" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_bm_select" ON public.%I', tbl, tbl);

    EXECUTE format('CREATE POLICY "%s_admin_all" ON public.%I FOR ALL TO authenticated
      USING (public.has_role(''admin''::public.app_role, auth.uid()))
      WITH CHECK (public.has_role(''admin''::public.app_role, auth.uid()))', tbl, tbl);

    EXECUTE format('CREATE POLICY "%s_lo_select" ON public.%I FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.loans l WHERE l.id = %I.loan_id AND l.loan_officer_id = auth.uid()
      ))', tbl, tbl, tbl);

    EXECUTE format('CREATE POLICY "%s_lo_insert" ON public.%I FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.loan_officer_id = auth.uid()
      ))', tbl, tbl);

    EXECUTE format('CREATE POLICY "%s_lo_update" ON public.%I FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.loans l WHERE l.id = %I.loan_id AND l.loan_officer_id = auth.uid()
      ))
      WITH CHECK (true)', tbl, tbl, tbl);

    EXECUTE format('CREATE POLICY "%s_lo_delete" ON public.%I FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.loans l WHERE l.id = %I.loan_id AND l.loan_officer_id = auth.uid()
      ))', tbl, tbl, tbl);

    EXECUTE format('CREATE POLICY "%s_uw_select" ON public.%I FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.loans l WHERE l.id = %I.loan_id AND l.underwriter_id = auth.uid()
      ))', tbl, tbl, tbl);

    EXECUTE format('CREATE POLICY "%s_bm_select" ON public.%I FOR SELECT TO authenticated
      USING (
        public.is_branch_manager(auth.uid()) AND EXISTS (
          SELECT 1 FROM public.loans l
          WHERE l.id = %I.loan_id AND l.branch_id IS NOT NULL
          AND l.branch_id = public.user_branch_id(auth.uid())
        )
      )', tbl, tbl, tbl);
  END LOOP;
END $$;

-- Underwriter policies on existing tables
DROP POLICY IF EXISTS "conditions_underwriter_all" ON public.loan_conditions;
CREATE POLICY "conditions_underwriter_all"
  ON public.loan_conditions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_conditions.loan_id AND l.underwriter_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_conditions.loan_id AND l.underwriter_id = auth.uid()
  ));

DROP POLICY IF EXISTS "milestones_underwriter_select" ON public.loan_milestones;
CREATE POLICY "milestones_underwriter_select"
  ON public.loan_milestones FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_milestones.loan_id AND l.underwriter_id = auth.uid()
  ));

DROP POLICY IF EXISTS "timeline_underwriter_select" ON public.loan_timeline_events;
CREATE POLICY "timeline_underwriter_select"
  ON public.loan_timeline_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_timeline_events.loan_id AND l.underwriter_id = auth.uid()
  ));

DROP POLICY IF EXISTS "timeline_underwriter_insert" ON public.loan_timeline_events;
CREATE POLICY "timeline_underwriter_insert"
  ON public.loan_timeline_events FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.underwriter_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- C. DOCUMENT MANAGEMENT SYSTEM
-- ─────────────────────────────────────────────────────────────────────────────

-- C1. Document type taxonomy
CREATE TABLE IF NOT EXISTS public.document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_types IS 'Standard mortgage document type taxonomy.';
COMMENT ON COLUMN public.document_types.category IS 'application | income | asset | property | identity | compliance | closing | other';

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_types_select_all" ON public.document_types;
CREATE POLICY "document_types_select_all"
  ON public.document_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "document_types_admin_all" ON public.document_types;
CREATE POLICY "document_types_admin_all"
  ON public.document_types FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Seed standard document types
INSERT INTO public.document_types (code, name, category, sort_order) VALUES
  ('1003', 'Uniform Residential Loan Application', 'application', 1),
  ('W2', 'W-2 Wage Statement', 'income', 10),
  ('PAY_STUB', 'Pay Stub', 'income', 11),
  ('TAX_RETURN', 'Tax Return (1040)', 'income', 12),
  ('BANK_STMT', 'Bank Statement', 'asset', 20),
  ('INVEST_STMT', 'Investment Account Statement', 'asset', 21),
  ('GIFT_LETTER', 'Gift Letter', 'asset', 22),
  ('VOE', 'Verification of Employment', 'income', 13),
  ('VOD', 'Verification of Deposit', 'asset', 23),
  ('CREDIT_REPORT', 'Credit Report', 'application', 2),
  ('APPRAISAL', 'Appraisal Report', 'property', 30),
  ('TITLE_COMMIT', 'Title Commitment', 'property', 31),
  ('HOMEOWNERS_INS', 'Homeowners Insurance', 'property', 32),
  ('FLOOD_CERT', 'Flood Certification', 'property', 33),
  ('DRIVERS_LICENSE', 'Driver''s License / Photo ID', 'identity', 40),
  ('SSN_CARD', 'Social Security Card', 'identity', 41),
  ('LOAN_ESTIMATE', 'Loan Estimate (LE)', 'compliance', 50),
  ('CLOSING_DISC', 'Closing Disclosure (CD)', 'compliance', 51),
  ('INITIAL_DISC', 'Initial Disclosures Package', 'compliance', 52),
  ('NOTE', 'Promissory Note', 'closing', 60),
  ('DEED_OF_TRUST', 'Deed of Trust / Mortgage', 'closing', 61),
  ('SETTLEMENT', 'Settlement Statement (HUD-1)', 'closing', 62),
  ('OTHER', 'Other Document', 'other', 99)
ON CONFLICT (code) DO NOTHING;

-- C2. Loan documents (metadata; files in Supabase Storage)
CREATE TABLE IF NOT EXISTS public.loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES public.borrowers(id) ON DELETE SET NULL,
  document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  review_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  loan_condition_id UUID REFERENCES public.loan_conditions(id) ON DELETE SET NULL,
  version INT NOT NULL DEFAULT 1,
  parent_document_id UUID REFERENCES public.loan_documents(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_documents IS 'Unified loan document index. Files stored in Supabase Storage bucket loan-documents.';
COMMENT ON COLUMN public.loan_documents.source IS 'manual | portal | los_sync | docusign';
COMMENT ON COLUMN public.loan_documents.review_status IS 'pending | accepted | rejected | needs_revision';

CREATE INDEX IF NOT EXISTS idx_loan_documents_loan_id ON public.loan_documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_documents_type ON public.loan_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_loan_documents_review ON public.loan_documents(review_status);
CREATE INDEX IF NOT EXISTS idx_loan_documents_condition ON public.loan_documents(loan_condition_id);

DROP TRIGGER IF EXISTS loan_documents_updated_at ON public.loan_documents;
CREATE TRIGGER loan_documents_updated_at
  BEFORE UPDATE ON public.loan_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_docs_admin_all" ON public.loan_documents;
CREATE POLICY "loan_docs_admin_all"
  ON public.loan_documents FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "loan_docs_lo_select" ON public.loan_documents;
CREATE POLICY "loan_docs_lo_select"
  ON public.loan_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_documents.loan_id AND l.loan_officer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "loan_docs_lo_insert" ON public.loan_documents;
CREATE POLICY "loan_docs_lo_insert"
  ON public.loan_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.loan_officer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "loan_docs_lo_update" ON public.loan_documents;
CREATE POLICY "loan_docs_lo_update"
  ON public.loan_documents FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_documents.loan_id AND l.loan_officer_id = auth.uid()
  ))
  WITH CHECK (true);

DROP POLICY IF EXISTS "loan_docs_lo_delete" ON public.loan_documents;
CREATE POLICY "loan_docs_lo_delete"
  ON public.loan_documents FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_documents.loan_id AND l.loan_officer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "loan_docs_uw_select" ON public.loan_documents;
CREATE POLICY "loan_docs_uw_select"
  ON public.loan_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_documents.loan_id AND l.underwriter_id = auth.uid()
  ));

DROP POLICY IF EXISTS "loan_docs_uw_update" ON public.loan_documents;
CREATE POLICY "loan_docs_uw_update"
  ON public.loan_documents FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_documents.loan_id AND l.underwriter_id = auth.uid()
  ))
  WITH CHECK (true);

DROP POLICY IF EXISTS "loan_docs_bm_select" ON public.loan_documents;
CREATE POLICY "loan_docs_bm_select"
  ON public.loan_documents FOR SELECT TO authenticated
  USING (
    public.is_branch_manager(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_documents.loan_id AND l.branch_id IS NOT NULL
      AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- C3. Program document requirements (checklist templates)
CREATE TABLE IF NOT EXISTS public.program_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.loan_programs(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, document_type_id)
);

COMMENT ON TABLE public.program_document_requirements IS 'Required/optional document types per loan program.';

ALTER TABLE public.program_document_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prog_doc_req_select_all" ON public.program_document_requirements;
CREATE POLICY "prog_doc_req_select_all"
  ON public.program_document_requirements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prog_doc_req_admin_all" ON public.program_document_requirements;
CREATE POLICY "prog_doc_req_admin_all"
  ON public.program_document_requirements FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- C4. Storage bucket for loan documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-documents',
  'loan-documents',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for loan-documents bucket
DROP POLICY IF EXISTS "loan_docs_storage_insert" ON storage.objects;
CREATE POLICY "loan_docs_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'loan-documents');

DROP POLICY IF EXISTS "loan_docs_storage_select" ON storage.objects;
CREATE POLICY "loan_docs_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'loan-documents');

DROP POLICY IF EXISTS "loan_docs_storage_delete" ON storage.objects;
CREATE POLICY "loan_docs_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'loan-documents');

-- ─────────────────────────────────────────────────────────────────────────────
-- D. PRODUCT & ELIGIBILITY ENGINE
-- ─────────────────────────────────────────────────────────────────────────────

-- Add guidelines JSONB to loan_programs for rich rule matrices
ALTER TABLE public.loan_programs
  ADD COLUMN IF NOT EXISTS guidelines JSONB DEFAULT '{}';

COMMENT ON COLUMN public.loan_programs.guidelines IS 'Rich eligibility rules: fico_ltv_matrix, property_types, documentation_types, reserves, MI thresholds.';

-- Seed guidelines for existing programs
UPDATE public.loan_programs SET guidelines = '{
  "fico_ltv_matrix": [
    { "min_fico": 740, "max_ltv": 97 },
    { "min_fico": 720, "max_ltv": 95 },
    { "min_fico": 700, "max_ltv": 90 },
    { "min_fico": 680, "max_ltv": 80 }
  ],
  "property_types": ["single_family", "condo", "townhouse", "pud"],
  "occupancy_types": ["primary"],
  "max_dti": 45,
  "min_reserves_months": 2,
  "mi_required_above_ltv": 80,
  "documentation_types": ["full_doc"]
}'::jsonb
WHERE program_code = 'CONV-30-80-700';

UPDATE public.loan_programs SET guidelines = '{
  "fico_ltv_matrix": [
    { "min_fico": 740, "max_ltv": 97 },
    { "min_fico": 720, "max_ltv": 95 }
  ],
  "property_types": ["single_family", "condo", "townhouse", "pud"],
  "occupancy_types": ["primary"],
  "max_dti": 45,
  "min_reserves_months": 2,
  "mi_required_above_ltv": 80,
  "documentation_types": ["full_doc"]
}'::jsonb
WHERE program_code = 'CONV-30-95-740';

UPDATE public.loan_programs SET guidelines = '{
  "fico_ltv_matrix": [
    { "min_fico": 580, "max_ltv": 96.5 },
    { "min_fico": 500, "max_ltv": 90 }
  ],
  "property_types": ["single_family", "condo", "townhouse", "pud", "manufactured"],
  "occupancy_types": ["primary"],
  "max_dti": 50,
  "min_reserves_months": 0,
  "mi_required_above_ltv": 0,
  "documentation_types": ["full_doc"]
}'::jsonb
WHERE program_code = 'FHA-30-965';

UPDATE public.loan_programs SET guidelines = '{
  "fico_ltv_matrix": [
    { "min_fico": 620, "max_ltv": 100 }
  ],
  "property_types": ["single_family", "condo", "townhouse", "pud"],
  "occupancy_types": ["primary"],
  "max_dti": 50,
  "min_reserves_months": 0,
  "mi_required_above_ltv": 0,
  "documentation_types": ["full_doc"],
  "va_funding_fee": true
}'::jsonb
WHERE program_code = 'VA-30-100';

-- Timeline event on document upload
CREATE OR REPLACE FUNCTION public.loan_document_timeline()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.loan_timeline_events (loan_id, event_type, event_source, title, metadata, created_by)
  VALUES (
    NEW.loan_id,
    'doc_uploaded',
    NEW.source,
    'Document uploaded: ' || NEW.file_name,
    jsonb_build_object('document_id', NEW.id, 'file_name', NEW.file_name, 'document_type_id', NEW.document_type_id),
    NEW.uploaded_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS loan_document_timeline_trigger ON public.loan_documents;
CREATE TRIGGER loan_document_timeline_trigger
  AFTER INSERT ON public.loan_documents
  FOR EACH ROW EXECUTE FUNCTION public.loan_document_timeline();
