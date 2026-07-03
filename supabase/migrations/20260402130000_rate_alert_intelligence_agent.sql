-- Rate Alert Intelligence Agent: monitors rate movements against active locks.
-- Creates rate_alert_analyses table and seeds the agent row.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_alert_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  rate_lock_id UUID NOT NULL REFERENCES public.rate_locks(id) ON DELETE CASCADE,
  loan_officer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('at_risk', 'float_down', 'no_action')),
  locked_rate NUMERIC(6,4),
  current_market_rate NUMERIC(6,4),
  rate_delta NUMERIC(6,4),
  days_remaining INTEGER,
  ai_narrative TEXT,
  ai_recommendation TEXT,
  severity TEXT NOT NULL DEFAULT 'none' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'none')),
  metadata JSONB DEFAULT '{}'::jsonb,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(loan_id, rate_lock_id)
);

CREATE INDEX IF NOT EXISTS idx_rate_alert_analyses_severity
  ON public.rate_alert_analyses (severity, scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_alert_analyses_loan
  ON public.rate_alert_analyses (loan_id, scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_alert_analyses_officer
  ON public.rate_alert_analyses (loan_officer_id, severity);

ALTER TABLE public.rate_alert_analyses ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "rate_alert_admin_all"
  ON public.rate_alert_analyses FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Loan officer: read own loans
CREATE POLICY "rate_alert_lo_select"
  ON public.rate_alert_analyses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = rate_alert_analyses.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

-- Loan officer: upsert own loans (edge fn uses service role, but allow manual too)
CREATE POLICY "rate_alert_lo_insert"
  ON public.rate_alert_analyses FOR INSERT
  TO authenticated
  WITH CHECK (
    loan_officer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "rate_alert_lo_update"
  ON public.rate_alert_analyses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = rate_alert_analyses.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (
    loan_officer_id = auth.uid()
  );

-- Branch manager: read branch loans
CREATE POLICY "rate_alert_bm_select"
  ON public.rate_alert_analyses FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = rate_alert_analyses.loan_id
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
  'rate-alert-intelligence-agent',
  'Rate Alert Intelligence Agent',
  'Monitors rate movements against locked and pipeline loans. Alerts officers when a borrower''s locked rate is at risk or a float-down opportunity exists. Turns rate volatility into a retention and trust moment.',
  'rate_intelligence',
  E'You are an expert mortgage rate analyst. You receive a JSON array of active rate locks, each with:\n- loan_id, loan_number, borrower_name, product_name\n- locked_rate, current_market_rate, rate_delta (current - locked)\n- days_remaining until lock expiration\n- lock_term_days (original lock period)\n- alert_type: "at_risk" (market rose above lock) or "float_down" (market dropped below lock)\n\nFor EACH lock, respond with a JSON array (same order) where each item has:\n{\n  "loan_id": "uuid",\n  "narrative": "2-3 sentence explanation of the rate impact on this borrower''s loan. Be specific with numbers.",\n  "recommendation": "Concrete next-step action for the loan officer. For float-downs, analyze whether relocking is worth it given days remaining and typical extension costs ($50-150/day). For at-risk, recommend protective actions."\n}\n\nGuidelines:\n- For float-down: Calculate approximate monthly payment savings. Mention that a float-down may involve extension fees if the lock period resets.\n- For at-risk: Emphasize urgency if expiring within 7 days. Suggest contacting borrower to reassure them their rate is protected.\n- Be concise, professional, and action-oriented.\n- Use real numbers from the data provided.\n\nRespond with ONLY a JSON array. No markdown fences.',
  ARRAY['rate_locks', 'rate_sheet_products', 'loans'],
  true,
  false,
  NULL,
  '{"type": "rate_intelligence", "ui_placement": "loan_detail_card"}'::jsonb,
  '{"model": "gpt-4o-mini", "temperature": 0.3}'::jsonb
) ON CONFLICT (slug) DO NOTHING;
