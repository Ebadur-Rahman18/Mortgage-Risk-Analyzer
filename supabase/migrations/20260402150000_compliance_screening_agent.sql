-- Compliance Screening Agent
-- Creates compliance_rules (rule catalog), compliance_screenings (results),
-- adds HMDA demographic columns to borrowers, and seeds the agent.

-- ── 1. HMDA columns on borrowers ────────────────────────────────────────────

ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS hmda_race        TEXT,
  ADD COLUMN IF NOT EXISTS hmda_ethnicity   TEXT,
  ADD COLUMN IF NOT EXISTS hmda_sex         TEXT,
  ADD COLUMN IF NOT EXISTS hmda_income      NUMERIC(15,2);

COMMENT ON COLUMN public.borrowers.hmda_race       IS 'HMDA race classification (e.g. White, Black, Asian, etc.). May be "Information not provided".';
COMMENT ON COLUMN public.borrowers.hmda_ethnicity   IS 'HMDA ethnicity classification (Hispanic or Latino, Not Hispanic or Latino, etc.).';
COMMENT ON COLUMN public.borrowers.hmda_sex         IS 'HMDA sex classification (Male, Female, Information not provided).';
COMMENT ON COLUMN public.borrowers.hmda_income      IS 'Gross annual income reported for HMDA LAR.';

-- ── 2. compliance_rules (rule catalog) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  regulation_group TEXT NOT NULL CHECK (regulation_group IN ('TRID', 'HMDA', 'Fair Lending')),
  name TEXT NOT NULL,
  description TEXT,
  check_field TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold NUMERIC,
  severity_on_fail TEXT NOT NULL DEFAULT 'fail' CHECK (severity_on_fail IN ('fail', 'warn')),
  severity_on_warn TEXT CHECK (severity_on_warn IS NULL OR severity_on_warn IN ('warn')),
  citation TEXT,
  remediation_hint TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_rules_group ON public.compliance_rules (regulation_group, enabled);

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD
CREATE POLICY "compliance_rules_admin_all"
  ON public.compliance_rules FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Branch manager + moderator: read-only
CREATE POLICY "compliance_rules_bm_select"
  ON public.compliance_rules FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    OR public.has_role('moderator'::public.app_role, auth.uid())
  );

-- ── 3. compliance_screenings (per-loan results) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  run_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  overall_result TEXT NOT NULL CHECK (overall_result IN ('pass', 'warning', 'fail')),
  pass_count INT NOT NULL DEFAULT 0,
  warn_count INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  ai_remediation JSONB DEFAULT '[]'::jsonb,
  model_used TEXT,
  latency_ms INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_screenings_loan
  ON public.compliance_screenings (loan_id, created_at DESC);

ALTER TABLE public.compliance_screenings ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "compliance_screenings_admin_all"
  ON public.compliance_screenings FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Moderator: read
CREATE POLICY "compliance_screenings_mod_select"
  ON public.compliance_screenings FOR SELECT
  TO authenticated
  USING (public.has_role('moderator'::public.app_role, auth.uid()));

-- Branch manager: read branch loans
CREATE POLICY "compliance_screenings_bm_select"
  ON public.compliance_screenings FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = compliance_screenings.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- ── 4. Seed default compliance rules ────────────────────────────────────────

INSERT INTO public.compliance_rules (code, regulation_group, name, description, check_field, operator, threshold, severity_on_fail, severity_on_warn, citation, remediation_hint) VALUES
-- TRID rules
('TRID-001', 'TRID', 'Loan Estimate Delivery Timing',
 'Loan Estimate must be delivered within 3 business days of application.',
 'milestone:loan_estimate_sent', 'days_from_application_lte', 3,
 'fail', 'warn',
 '12 CFR §1026.19(e)(1)(iii)',
 'Ensure LE is generated and delivered within 3 business days of receiving the borrower''s application.'),

('TRID-002', 'TRID', 'Closing Disclosure Delivery Timing',
 'Closing Disclosure must be delivered at least 3 business days before closing.',
 'milestone:closing_disclosure_sent', 'days_before_closing_gte', 3,
 'fail', 'warn',
 '12 CFR §1026.19(f)(1)(ii)',
 'CD must be received by borrower no later than 3 business days before consummation.'),

('TRID-003', 'TRID', 'Loan Estimate Provided',
 'A Loan Estimate document must be on file for the loan.',
 'milestone:loan_estimate_sent', 'exists', NULL,
 'fail', NULL,
 '12 CFR §1026.19(e)',
 'Generate and deliver a Loan Estimate before proceeding. This is a mandatory disclosure.'),

('TRID-004', 'TRID', 'Closing Disclosure Provided',
 'A Closing Disclosure document must be on file before closing.',
 'milestone:closing_disclosure_sent', 'exists', NULL,
 'fail', NULL,
 '12 CFR §1026.19(f)',
 'Generate and deliver a Closing Disclosure before scheduling closing.'),

('TRID-005', 'TRID', 'APR / Rate Lock Consistency',
 'Rate lock data must be present and consistent for APR disclosure accuracy.',
 'loan:lock_date', 'not_empty', NULL,
 'warn', 'warn',
 '12 CFR §1026.37(l)',
 'Ensure rate lock is recorded so APR on disclosures matches the locked terms.'),

-- HMDA rules
('HMDA-001', 'HMDA', 'Borrower Race Data',
 'Borrower race must be collected for HMDA LAR reporting.',
 'borrower:hmda_race', 'not_empty', NULL,
 'fail', NULL,
 '12 CFR §1003.4(a)(10)',
 'Collect borrower race per HMDA requirements. If borrower declines, record as "Information not provided".'),

('HMDA-002', 'HMDA', 'Borrower Ethnicity Data',
 'Borrower ethnicity must be collected for HMDA LAR reporting.',
 'borrower:hmda_ethnicity', 'not_empty', NULL,
 'fail', NULL,
 '12 CFR §1003.4(a)(10)',
 'Collect borrower ethnicity. If declined, record as "Information not provided".'),

('HMDA-003', 'HMDA', 'Borrower Sex Data',
 'Borrower sex must be collected for HMDA LAR reporting.',
 'borrower:hmda_sex', 'not_empty', NULL,
 'fail', NULL,
 '12 CFR §1003.4(a)(10)',
 'Collect borrower sex. If declined, record as "Information not provided".'),

('HMDA-004', 'HMDA', 'Property Geographic Data',
 'Full property address (address, city, state, zip) required for HMDA geocoding.',
 'loan:property_address_complete', 'all_present', NULL,
 'fail', 'warn',
 '12 CFR §1003.4(a)(9)',
 'Complete all property address fields so the loan can be geocoded for census tract / MSA reporting.'),

('HMDA-005', 'HMDA', 'Loan Purpose Classification',
 'Loan purpose must be set for HMDA action-type reporting.',
 'loan:purpose', 'not_empty', NULL,
 'fail', NULL,
 '12 CFR §1003.4(a)(3)',
 'Set loan purpose (Purchase, Refinance, etc.) to satisfy HMDA LAR requirements.'),

('HMDA-006', 'HMDA', 'Income Reported',
 'Gross annual income must be reported for HMDA LAR.',
 'borrower:hmda_income', 'gt', 0,
 'warn', 'warn',
 '12 CFR §1003.4(a)(7)',
 'Record borrower gross annual income. Required for HMDA unless exemption applies.'),

-- Fair Lending rules
('FAIR-001', 'Fair Lending', 'Rate Consistency by Credit Tier',
 'Locked rate should be within expected range for borrower credit tier (±50 bps).',
 'rate_lock:rate_vs_credit_tier', 'within_range_bps', 50,
 'warn', 'warn',
 'ECOA 15 U.S.C. §1691; Fair Housing Act §3605',
 'Document justification for any rate deviation exceeding 50 bps from the standard tier pricing.'),

('FAIR-002', 'Fair Lending', 'Pricing Exception Documentation',
 'If rate deviates from standard pricing, an exception must be documented in the timeline.',
 'timeline:pricing_exception_documented', 'conditional_exists', NULL,
 'warn', 'warn',
 'ECOA Regulation B §1002.4',
 'If a pricing exception was granted, add a timeline event documenting the exception reason and approver.'),

('FAIR-003', 'Fair Lending', 'Denial Reason Documentation',
 'If loan was denied or withdrawn, reasons must be recorded in the timeline.',
 'loan:denial_documented', 'conditional_exists', NULL,
 'fail', NULL,
 'ECOA 15 U.S.C. §1691(d); Regulation B §1002.9',
 'Record adverse action reasons within 30 days of denial. Required under ECOA and Fair Housing Act.'),

('FAIR-004', 'Fair Lending', 'Occupancy–Purpose Consistency',
 'Occupancy type must be consistent with stated loan purpose.',
 'loan:occupancy_purpose_consistent', 'consistent', NULL,
 'warn', 'warn',
 'Fair Housing Act §3604; ECOA §1691(a)',
 'Verify that occupancy type aligns with loan purpose. Investment occupancy with primary-home purpose may indicate a data-entry error or misrepresentation.')
ON CONFLICT (code) DO NOTHING;

-- ── 5. Seed agent row ───────────────────────────────────────────────────────

INSERT INTO public.ai_agents (
  slug,
  name,
  description,
  category,
  system_prompt,
  data_sources,
  is_enabled,
  memory_enabled,
  required_role,
  metadata,
  provider_config
) VALUES (
  'compliance-screening-agent',
  'Compliance Screening Agent',
  'Checks each loan against TRID, HMDA, and fair lending rules. Produces a compliance checklist with pass/warn/fail per regulation. Banks sleep easy knowing every loan is compliance-checked before close.',
  'compliance',
  E'You are an expert mortgage compliance officer. You receive a JSON object with:\n- loan details (loan_number, status, purpose, occupancy, credit_score, dti, ltv, etc.)\n- a list of compliance check results, each with: code, regulation_group, name, result (pass/warn/fail), actual_value, issue_note, citation\n\nFor each regulation group (TRID, HMDA, Fair Lending), provide:\n1. A brief group-level assessment (1-2 sentences).\n2. For each FAILED or WARNING check, a remediation recommendation with:\n   - "code": the check code\n   - "recommendation": specific action to fix the issue (2-3 sentences)\n   - "citation_ref": the relevant CFR or statute section\n   - "urgency": "high" | "medium" | "low"\n\nRespond as JSON:\n{\n  "summary": "Overall compliance assessment in 2-3 sentences.",\n  "group_assessments": { "TRID": "...", "HMDA": "...", "Fair Lending": "..." },\n  "remediations": [ { "code": "...", "recommendation": "...", "citation_ref": "...", "urgency": "..." } ]\n}\n\nBe specific, cite exact regulations, and prioritise the most critical issues first.\nRespond with ONLY valid JSON. No markdown fences.',
  ARRAY['compliance_rules', 'loans', 'borrowers', 'loan_milestones', 'loan_timeline_events'],
  true,
  false,
  NULL,
  '{"type": "compliance", "ui_placement": "loan_detail_section"}'::jsonb,
  '{"model": "gpt-4o-mini", "temperature": 0.2}'::jsonb
) ON CONFLICT (slug) DO NOTHING;
