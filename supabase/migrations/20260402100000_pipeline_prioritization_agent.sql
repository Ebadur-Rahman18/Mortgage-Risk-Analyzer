-- Pipeline Prioritization Agent: scores + ranks open loans by urgency.
-- Creates pipeline_priority_scores table and seeds the agent row.
-- Also creates a pg_cron job to run daily at 7 AM UTC (requires pg_cron + pg_net extensions).

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_priority_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  loan_officer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  urgency_score INTEGER NOT NULL DEFAULT 0,
  sla_risk_sub NUMERIC(5,2) DEFAULT 0,
  lock_expiry_sub NUMERIC(5,2) DEFAULT 0,
  engagement_sub NUMERIC(5,2) DEFAULT 0,
  close_probability_sub NUMERIC(5,2) DEFAULT 0,
  urgency_reason TEXT,
  ai_engagement_note TEXT,
  ai_close_note TEXT,
  model_used TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(loan_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_priority_scores_urgency
  ON public.pipeline_priority_scores (urgency_score DESC, scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_priority_scores_officer
  ON public.pipeline_priority_scores (loan_officer_id, urgency_score DESC);

ALTER TABLE public.pipeline_priority_scores ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "pipeline_priority_admin_all"
  ON public.pipeline_priority_scores FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Loan officer: read own loans
CREATE POLICY "pipeline_priority_lo_select"
  ON public.pipeline_priority_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = pipeline_priority_scores.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

-- Loan officer: upsert own loans (needed when manually triggering re-rank)
CREATE POLICY "pipeline_priority_lo_insert"
  ON public.pipeline_priority_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    loan_officer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "pipeline_priority_lo_update"
  ON public.pipeline_priority_scores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = pipeline_priority_scores.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (
    loan_officer_id = auth.uid()
  );

-- Branch manager: read branch loans
CREATE POLICY "pipeline_priority_bm_select"
  ON public.pipeline_priority_scores FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = pipeline_priority_scores.loan_id
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
  'pipeline-prioritization-agent',
  'Pipeline Prioritization Agent',
  'Analyzes all open loans and re-ranks them by urgency: SLA risk, rate-lock expiry, borrower engagement score, and estimated close probability. Officers always work the right loan next.',
  'pipeline',
  E'You are an expert mortgage pipeline analyst. You receive a JSON array of open loans, each with:\n- loan_id, loan_number, status, loan_amount, dti, ltv, credit_score\n- sla_risk_score (0-100), lock_expiry_risk (0-100), days_to_lock_expiry\n- conditions_pending, conditions_total, milestones_completed, milestones_total\n- recent_comms_count (borrower communications in last 14 days)\n- last_timeline_event_days_ago\n\nFor EACH loan, respond with a JSON array (same order) where each item has:\n{\n  "loan_id": "uuid",\n  "engagement_score": 0-100,\n  "close_probability": 0-100,\n  "urgency_reason": "One-sentence explanation of why this loan needs attention now",\n  "engagement_note": "Brief assessment of borrower engagement level",\n  "close_note": "Brief assessment of close readiness"\n}\n\nScoring guidance:\n- engagement_score: High (70-100) if recent comms, active milestone progress, portal activity. Low (0-30) if no comms in 14 days, stalled milestones.\n- close_probability: High (70-100) if good DTI/LTV/credit, most conditions cleared, key milestones done. Low (0-30) if major issues, many pending conditions.\n- urgency_reason: Focus on the single most critical factor (e.g. "Lock expires in 3 days with 5 pending conditions").\n\nRespond with ONLY a JSON array. No markdown fences.',
  ARRAY['loans', 'loan_conditions', 'loan_milestones', 'loan_risk_scores', 'borrower_communications', 'loan_timeline_events'],
  true,
  false,
  NULL,
  '{"type": "pipeline", "ui_placement": "loans_priority_queue"}'::jsonb,
  '{"model": "gpt-4o-mini", "temperature": 0.2}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- ── pg_cron job (requires pg_cron + pg_net extensions enabled) ───────────────
-- This schedules the edge function to run daily at 7:00 AM UTC.
-- The job calls the edge function URL with the service role key.
-- NOTE: You must enable pg_cron and pg_net extensions in Supabase Dashboard
--       BEFORE running this migration, OR run this section separately.

-- Uncomment the block below after enabling pg_cron + pg_net extensions:
/*
SELECT cron.schedule(
  'pipeline-priority-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/pipeline-prioritization-agent',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"mode": "cron"}'::jsonb
  );
  $$
);
*/
