-- Phase 3: Pricing & Compliance — schema extensions, fee engine, compliance rules, QC, AUS submissions
-- Idempotent where possible.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rate sheets / products — investor & LLPAs & scenario filters
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rate_sheets
  ADD COLUMN IF NOT EXISTS investor_code TEXT;

COMMENT ON COLUMN public.rate_sheets.investor_code IS 'Optional investor/channel code for multi-investor pricing (e.g. AGENCY_A).';

ALTER TABLE public.rate_sheet_products
  ADD COLUMN IF NOT EXISTS adjustments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.rate_sheet_products
  ADD COLUMN IF NOT EXISTS occupancy_filter TEXT[];

ALTER TABLE public.rate_sheet_products
  ADD COLUMN IF NOT EXISTS purpose_filter TEXT[];

ALTER TABLE public.rate_sheet_products
  ADD COLUMN IF NOT EXISTS property_type_filter TEXT[];

COMMENT ON COLUMN public.rate_sheet_products.adjustments IS 'LLPA rules: [{ "when": { "occupancy": "investment", ... }, "add_rate_bps": number, "add_price": number }]';
COMMENT ON COLUMN public.rate_sheet_products.occupancy_filter IS 'If set, row applies only when scenario occupancy is in list (lowercase tokens: primary, second_home, investment).';
COMMENT ON COLUMN public.rate_sheet_products.purpose_filter IS 'purchase, rate_term_refinance, cash_out_refinance, etc.';
COMMENT ON COLUMN public.rate_sheet_products.property_type_filter IS 'sfr, condo, two_to_four_unit, etc.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fee templates & loan fee estimates (LE/CD-oriented snapshots)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fee_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fee_template_versions IS 'Closing cost line templates (internal codes; illustrative LE/CD-style estimates).';
COMMENT ON COLUMN public.fee_template_versions.lines IS 'JSON array: [{ "code", "label", "category", "fee_type": "flat|percent", "amount_flat", "percent_of_loan", "paid_by" }]';

CREATE TABLE IF NOT EXISTS public.loan_fee_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  estimate_type TEXT NOT NULL CHECK (estimate_type IN ('LE', 'CD', 'ILLUSTRATIVE')),
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_borrower NUMERIC(15,2),
  total_seller NUMERIC(15,2),
  disclaimer TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_fee_estimates_loan ON public.loan_fee_estimates(loan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Compliance rules (deterministic)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  regulation_tag TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  blocking BOOLEAN NOT NULL DEFAULT false,
  predicate JSONB NOT NULL DEFAULT '{}'::jsonb,
  message_pass TEXT,
  message_fail TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.compliance_rules.predicate IS 'JSON: { "path": "loan.lock_expiration_date", "op": "exists" } | { "path": "loan.loan_amount", "op": "gt", "value": 0 }';

CREATE TABLE IF NOT EXISTS public.compliance_rule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_runs_loan ON public.compliance_rule_runs(loan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. QC checklist
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qc_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.qc_checklist_templates.items IS 'Array of { "id", "label", "category", "required": bool }';

CREATE TABLE IF NOT EXISTS public.loan_qc_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.qc_checklist_templates(id) ON DELETE SET NULL,
  item_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'na')),
  notes TEXT,
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_off_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_off_at TIMESTAMPTZ,
  UNIQUE(loan_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_loan_qc_results_loan ON public.loan_qc_results(loan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AUS submission stub
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aus_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('du', 'lp', 'other')),
  status TEXT NOT NULL DEFAULT 'stub_pending' CHECK (status IN ('stub_pending', 'submitted', 'completed', 'error')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,
  external_ref TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aus_submissions_loan ON public.aus_submissions(loan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fee_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_fee_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_qc_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aus_submissions ENABLE ROW LEVEL SECURITY;

-- Fee templates: read all authenticated; admin manage
DROP POLICY IF EXISTS "fee_templates_select_all" ON public.fee_template_versions;
CREATE POLICY "fee_templates_select_all"
  ON public.fee_template_versions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fee_templates_admin_all" ON public.fee_template_versions;
CREATE POLICY "fee_templates_admin_all"
  ON public.fee_template_versions FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Helper: user can access loan (inline in policies)
-- loan_fee_estimates
DROP POLICY IF EXISTS "loan_fee_estimates_access_select" ON public.loan_fee_estimates;
CREATE POLICY "loan_fee_estimates_access_select"
  ON public.loan_fee_estimates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_fee_estimates.loan_id
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

DROP POLICY IF EXISTS "loan_fee_estimates_access_insert" ON public.loan_fee_estimates;
CREATE POLICY "loan_fee_estimates_access_insert"
  ON public.loan_fee_estimates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_fee_estimates.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
        )
    )
  );

-- compliance_rules catalog
DROP POLICY IF EXISTS "compliance_rules_select_all" ON public.compliance_rules;
CREATE POLICY "compliance_rules_select_all"
  ON public.compliance_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "compliance_rules_admin_all" ON public.compliance_rules;
CREATE POLICY "compliance_rules_admin_all"
  ON public.compliance_rules FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- compliance_rule_runs
DROP POLICY IF EXISTS "compliance_runs_select" ON public.compliance_rule_runs;
CREATE POLICY "compliance_runs_select"
  ON public.compliance_rule_runs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = compliance_rule_runs.loan_id
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

DROP POLICY IF EXISTS "compliance_runs_insert" ON public.compliance_rule_runs;
CREATE POLICY "compliance_runs_insert"
  ON public.compliance_rule_runs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin'::public.app_role, auth.uid())
    OR public.is_branch_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = compliance_rule_runs.loan_id AND l.underwriter_id = auth.uid()
    )
  );

-- qc templates
DROP POLICY IF EXISTS "qc_templates_select" ON public.qc_checklist_templates;
CREATE POLICY "qc_templates_select"
  ON public.qc_checklist_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "qc_templates_admin" ON public.qc_checklist_templates;
CREATE POLICY "qc_templates_admin"
  ON public.qc_checklist_templates FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- loan_qc_results
DROP POLICY IF EXISTS "loan_qc_select" ON public.loan_qc_results;
CREATE POLICY "loan_qc_select"
  ON public.loan_qc_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_qc_results.loan_id
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

DROP POLICY IF EXISTS "loan_qc_all_roles" ON public.loan_qc_results;
CREATE POLICY "loan_qc_all_roles"
  ON public.loan_qc_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_qc_results.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_qc_results.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
        )
    )
  );

-- aus_submissions
DROP POLICY IF EXISTS "aus_sub_select" ON public.aus_submissions;
CREATE POLICY "aus_sub_select"
  ON public.aus_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = aus_submissions.loan_id
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

DROP POLICY IF EXISTS "aus_sub_insert" ON public.aus_submissions;
CREATE POLICY "aus_sub_insert"
  ON public.aus_submissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = aus_submissions.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "aus_sub_update" ON public.aus_submissions;
CREATE POLICY "aus_sub_update"
  ON public.aus_submissions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = aus_submissions.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Seed: default fee template, QC template, compliance rules, demo rate sheet
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.fee_template_versions (name, effective_date, lines, is_active)
SELECT
  'Default Illustrative LE v1',
  CURRENT_DATE,
  '[
    {"code":"origination","label":"Loan origination fee","category":"origination","fee_type":"percent","percent_of_loan":1,"paid_by":"borrower"},
    {"code":"appraisal","label":"Appraisal fee","category":"services","fee_type":"flat","amount_flat":600,"paid_by":"borrower"},
    {"code":"credit","label":"Credit report","category":"services","fee_type":"flat","amount_flat":75,"paid_by":"borrower"},
    {"code":"title","label":"Title services (estimate)","category":"title","fee_type":"flat","amount_flat":1200,"paid_by":"borrower"},
    {"code":"recording","label":"Government recording","category":"taxes_gov","fee_type":"flat","amount_flat":125,"paid_by":"borrower"},
    {"code":"transfer_tax","label":"Transfer taxes (if applicable)","category":"taxes_gov","fee_type":"flat","amount_flat":0,"paid_by":"borrower"}
  ]'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.fee_template_versions WHERE name = 'Default Illustrative LE v1');

INSERT INTO public.qc_checklist_templates (name, items, is_active, sort_order)
SELECT
  'Standard pre-close QC',
  '[
    {"id":"urla_signed","label":"Signed URLA / 1003 on file","category":"application","required":true},
    {"id":"credit_valid","label":"Credit report valid / not expired","category":"credit","required":true},
    {"id":"appraisal","label":"Appraisal or waiver in file","category":"collateral","required":true},
    {"id":"title","label":"Title commitment reviewed","category":"title","required":true},
    {"id":"insurance","label":"Hazard insurance evidence","category":"insurance","required":true},
    {"id":"trid_timeline","label":"TRID timing checks passed (LE/CD dates)","category":"compliance","required":false}
  ]'::jsonb,
  true,
  0
WHERE NOT EXISTS (SELECT 1 FROM public.qc_checklist_templates WHERE name = 'Standard pre-close QC');

INSERT INTO public.compliance_rules (code, title, regulation_tag, severity, blocking, predicate, message_pass, message_fail, sort_order)
VALUES
  ('LOCK_DATE_001','Lock expiration captured','TRID','warning',false,
   '{"path":"lock_expiration_date","entity":"loan","op":"exists"}'::jsonb,
   'Lock expiration date is set.','Loan is missing lock expiration date — verify lock status.',10),
  ('AMOUNT_001','Positive loan amount','RESPA','error',true,
   '{"path":"loan_amount","entity":"loan","op":"gt","value":0}'::jsonb,
   'Loan amount is present and positive.','Loan amount must be greater than zero.',20),
  ('STATE_001','Subject property state','HMDA','warning',false,
   '{"path":"property_state","entity":"loan","op":"exists"}'::jsonb,
   'Property state is populated.','Property state should be populated for compliance reporting.',30),
  ('ADDR_001','Property address','TRID','info',false,
   '{"path":"property_address","entity":"loan","op":"exists"}'::jsonb,
   'Property address on file.','Property address missing — required for disclosures.',40),
  ('LTV_001','LTV within entered range','General','warning',false,
   '{"path":"ltv","entity":"loan","op":"between","min":1,"max":97}'::jsonb,
   'LTV is in typical review band.','LTV outside 1–97% — verify collateral and program.',50)
ON CONFLICT (code) DO NOTHING;

-- Demo rate sheet (only if none named this)
INSERT INTO public.rate_sheets (name, source_type, effective_date, expiration_date, status, investor_code, metadata)
SELECT
  'Demo Investor A – Phase 3 Sample',
  'upload',
  (CURRENT_DATE - interval '30 days')::date,
  (CURRENT_DATE + interval '365 days')::date,
  'active',
  'INVESTOR_A',
  '{"quote_type":"indicative"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.rate_sheets WHERE name = 'Demo Investor A – Phase 3 Sample'
);

INSERT INTO public.rate_sheet_products (
  rate_sheet_id, product_name, loan_type, min_credit_score, max_ltv,
  min_loan_amount, max_loan_amount, state, rate, price,
  occupancy_filter, purpose_filter, property_type_filter, adjustments
)
SELECT
  rs.id,
  'Conv 30 Fixed Agency',
  'CONVENTIONAL',
  620,
  95,
  100000,
  2000000,
  'ALL',
  6.875,
  100.25,
  ARRAY['primary','second_home','investment'],
  ARRAY['purchase','rate_term_refinance','cash_out_refinance'],
  ARRAY['sfr','condo','two_to_four_unit'],
  '[
    {"when":{"occupancy":"investment"},"add_rate_bps":37.5},
    {"when":{"property_type":"condo"},"add_rate_bps":12.5,"add_price":-0.125},
    {"when":{"purpose":"cash_out_refinance"},"add_rate_bps":25}
  ]'::jsonb
FROM public.rate_sheets rs
WHERE rs.name = 'Demo Investor A – Phase 3 Sample'
  AND NOT EXISTS (
    SELECT 1 FROM public.rate_sheet_products p WHERE p.rate_sheet_id = rs.id
  );

INSERT INTO public.rate_sheet_products (
  rate_sheet_id, product_name, loan_type, min_credit_score, max_ltv,
  state, rate, price, occupancy_filter, purpose_filter, property_type_filter, adjustments
)
SELECT
  rs.id,
  'FHA 30 Fixed',
  'FHA',
  580,
  96.5,
  'ALL',
  6.625,
  99.5,
  ARRAY['primary','second_home','investment'],
  ARRAY['purchase','rate_term_refinance'],
  ARRAY['sfr','condo'],
  '[]'::jsonb
FROM public.rate_sheets rs
WHERE rs.name = 'Demo Investor A – Phase 3 Sample'
  AND NOT EXISTS (
    SELECT 1 FROM public.rate_sheet_products p
    WHERE p.rate_sheet_id = rs.id AND p.product_name = 'FHA 30 Fixed'
  );
