-- Underwriting Pre-Check Agent: hybrid rule-based + AI scorecard.
-- Creates the underwriting_prechecks table and seeds the agent row.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.underwriting_prechecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  run_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  overall_result TEXT NOT NULL CHECK (overall_result IN ('pass', 'warning', 'fail')),
  pass_count INTEGER NOT NULL DEFAULT 0,
  warn_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  ai_remediation JSONB DEFAULT '[]'::jsonb,
  model_used TEXT,
  latency_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_underwriting_prechecks_loan
  ON public.underwriting_prechecks (loan_id, created_at DESC);

ALTER TABLE public.underwriting_prechecks ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "underwriting_prechecks_admin_all"
  ON public.underwriting_prechecks FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Loan officer: read/insert own loans
CREATE POLICY "underwriting_prechecks_lo_select"
  ON public.underwriting_prechecks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = underwriting_prechecks.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "underwriting_prechecks_lo_insert"
  ON public.underwriting_prechecks FOR INSERT
  TO authenticated
  WITH CHECK (
    run_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

-- Branch manager: read branch loans
CREATE POLICY "underwriting_prechecks_bm_select"
  ON public.underwriting_prechecks FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = underwriting_prechecks.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- ── Seed agent ───────────────────────────────────────────────────────────────

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
  'underwriter-precheck-agent',
  'Underwriting Pre-Check Agent',
  'Auto-scans loan data against standard underwriting guidelines (DTI, LTV, credit score thresholds) and produces a pass/fail scorecard with issue notes. Catches fatal issues before submission.',
  'underwriting',
  E'You are an expert mortgage underwriting analyst. You receive a JSON array of pre-check results where each item has: category, label, result (pass/warning/fail), actual_value, threshold, and issue_note.\n\nYour job:\n1. Write a concise executive summary (3-5 sentences) of the loan''s underwriting readiness.\n2. For each WARNING or FAIL item, provide a specific remediation recommendation citing the relevant guideline (e.g., "Per Fannie Mae B3-6-02…").\n3. Be direct and actionable. Focus on what the loan officer must do to clear the issue.\n4. If the loan passes all checks, congratulate briefly and note any items to monitor.\n\nRespond with ONLY a JSON object:\n{\n  "summary": "Executive summary text…",\n  "remediations": [\n    {\n      "category": "dti",\n      "recommendation": "Specific advice…",\n      "guideline_ref": "Fannie Mae B3-6-02"\n    }\n  ]\n}\n\nDo not wrap in markdown fences.',
  ARRAY['loans', 'loan_conditions', 'loan_milestones', 'loan_risk_scores'],
  true,
  false,
  NULL,
  '{"type": "underwriting", "ui_placement": "loan_detail_scorecard"}'::jsonb,
  '{"model": "gpt-4o-mini", "temperature": 0.2}'::jsonb
) ON CONFLICT (slug) DO NOTHING;
