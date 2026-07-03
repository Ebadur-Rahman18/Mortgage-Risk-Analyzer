-- Branch Performance Coach Agent
-- Weekly AI coaching narratives for branch managers with recommended actions.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.branch_coaching_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  narrative TEXT NOT NULL,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  officer_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_model TEXT,
  latency_ms INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.branch_coaching_digests IS 'AI-generated weekly coaching narratives per branch with recommended actions.';
COMMENT ON COLUMN public.branch_coaching_digests.branch_id IS 'NULL = org-wide digest (admin).';
COMMENT ON COLUMN public.branch_coaching_digests.recommended_actions IS 'JSON array of {title, description, assigned_to_user_id, assigned_to_name, loan_id, loan_number, priority}.';
COMMENT ON COLUMN public.branch_coaching_digests.officer_metrics IS 'JSON object keyed by officer ID with aggregated performance stats.';

CREATE INDEX IF NOT EXISTS idx_coaching_digests_branch
  ON public.branch_coaching_digests (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coaching_digests_created
  ON public.branch_coaching_digests (created_at DESC);

ALTER TABLE public.branch_coaching_digests ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "coaching_digests_admin_all"
  ON public.branch_coaching_digests FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Moderator: read all
CREATE POLICY "coaching_digests_mod_select"
  ON public.branch_coaching_digests FOR SELECT
  TO authenticated
  USING (public.has_role('moderator'::public.app_role, auth.uid()));

-- Branch manager: read + insert own branch
CREATE POLICY "coaching_digests_bm_select"
  ON public.branch_coaching_digests FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND (
      branch_id IS NULL
      OR branch_id = public.user_branch_id(auth.uid())
    )
  );

CREATE POLICY "coaching_digests_bm_insert"
  ON public.branch_coaching_digests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_branch_manager(auth.uid())
    AND generated_by = auth.uid()
    AND (
      branch_id IS NULL
      OR branch_id = public.user_branch_id(auth.uid())
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
  'branch-performance-coach-agent',
  'Branch Performance Coach Agent',
  'Weekly AI narrative for branch managers: what''s working, what''s lagging, which officers need coaching, and what actions will move the needle. Managers get a data-driven coaching plan, not just charts.',
  'coaching',
  E'You are an expert mortgage branch performance coach. You receive a JSON object with:\n- branch_name (or "Organization" for org-wide)\n- period: { start, end }\n- officer_metrics: array of objects per loan officer with:\n  - name, officer_id\n  - active_loans, new_loans_period, closed_period\n  - avg_days_in_status, stuck_over_30d, stuck_15_30d\n  - high_risk_count, critical_risk_count\n  - pending_conditions, overdue_milestones\n  - lock_expiring_7d, urgent_priority_count\n\nYou MUST respond as JSON with:\n{\n  "narrative": "2-3 paragraphs of coaching narrative. Start with what''s going well, then address areas of concern, then spotlight officers who need attention. Be specific with numbers. Be encouraging but honest.",\n  "recommended_actions": [\n    {\n      "title": "Short action title (5-10 words)",\n      "description": "1-2 sentence description of what to do and why",\n      "assigned_to_user_id": "officer UUID who should receive this task",\n      "assigned_to_name": "officer display name",\n      "loan_id": "optional loan UUID if action is loan-specific",\n      "loan_number": "optional loan number",\n      "priority": "high | normal | low"\n    }\n  ]\n}\n\nProvide EXACTLY 3 recommended_actions. Prioritise the most impactful actions first.\nFocus on actionable steps, not generic advice.\nRespond with ONLY valid JSON. No markdown fences.',
  ARRAY['loans', 'loan_risk_scores', 'loan_conditions', 'loan_milestones', 'pipeline_priority_scores', 'profiles'],
  true,
  false,
  NULL,
  '{"type": "coaching", "ui_placement": "manager_dashboard_card"}'::jsonb,
  '{"model": "gpt-4o-mini", "temperature": 0.4}'::jsonb
) ON CONFLICT (slug) DO NOTHING;
