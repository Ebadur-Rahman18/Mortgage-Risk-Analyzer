-- Automated Loan Condition Workflow
-- Adds assignment, priority, and workflow-rule-based automation to loan conditions.

-- ── New columns on loan_conditions ───────────────────────────────────────────

ALTER TABLE public.loan_conditions
  ADD COLUMN IF NOT EXISTS assigned_party TEXT
    CHECK (assigned_party IS NULL OR assigned_party IN ('borrower','processor','title','loan_officer','internal')),
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','urgent'));

CREATE INDEX IF NOT EXISTS idx_loan_conditions_assigned_party
  ON public.loan_conditions (assigned_party) WHERE assigned_party IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loan_conditions_assigned_to
  ON public.loan_conditions (assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;

-- ── Condition Workflow Rules table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.condition_workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_type TEXT NOT NULL CHECK (condition_type IN ('PTD','PTF','PTC')),
  category_keyword TEXT NOT NULL,
  assigned_party TEXT NOT NULL
    CHECK (assigned_party IN ('borrower','processor','title','loan_officer','internal')),
  auto_due_days INT NOT NULL DEFAULT 5,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(condition_type, category_keyword)
);

COMMENT ON TABLE public.condition_workflow_rules IS
  'Maps condition type + category keyword to default assignee party, due days, and priority.';

ALTER TABLE public.condition_workflow_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_rules_admin_all"
  ON public.condition_workflow_rules FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "workflow_rules_read_staff"
  ON public.condition_workflow_rules FOR SELECT
  TO authenticated
  USING (true);

-- ── Seed workflow rules ──────────────────────────────────────────────────────

INSERT INTO public.condition_workflow_rules
  (condition_type, category_keyword, assigned_party, auto_due_days, priority)
VALUES
  -- PTD: Prior-to-Docs — typically borrower-facing document requests
  ('PTD', 'income',          'borrower',      5, 'normal'),
  ('PTD', 'assets',          'borrower',      5, 'normal'),
  ('PTD', 'employment',      'borrower',      5, 'normal'),
  ('PTD', 'credit',          'borrower',      3, 'urgent'),
  ('PTD', 'identity',        'borrower',      3, 'normal'),
  ('PTD', 'insurance',       'borrower',      7, 'normal'),
  ('PTD', 'tax',             'borrower',      5, 'normal'),
  ('PTD', 'appraisal',       'internal',      7, 'normal'),

  -- PTF: Prior-to-Fund — often processor or internal
  ('PTF', 'title',           'title',         7, 'normal'),
  ('PTF', 'insurance',       'borrower',      5, 'normal'),
  ('PTF', 'payoff',          'title',         5, 'urgent'),
  ('PTF', 'verification',    'processor',     3, 'normal'),
  ('PTF', 'compliance',      'internal',      5, 'normal'),

  -- PTC: Prior-to-Close — time-sensitive
  ('PTC', 'title',           'title',         5, 'urgent'),
  ('PTC', 'closing',         'processor',     3, 'urgent'),
  ('PTC', 'final',           'loan_officer',  3, 'urgent'),
  ('PTC', 'disclosure',      'internal',      3, 'normal'),
  ('PTC', 'signing',         'borrower',      3, 'urgent')
ON CONFLICT (condition_type, category_keyword) DO NOTHING;
