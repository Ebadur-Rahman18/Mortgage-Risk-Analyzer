-- Team Leaderboard & Gamification
-- Creates badge_definitions, officer_badges, and leaderboard_scores tables.

-- ── badge_definitions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon_name TEXT NOT NULL DEFAULT 'award',
  criteria_type TEXT NOT NULL
    CHECK (criteria_type IN ('closed_count','pipeline_volume','on_time_rate','conditions_speed','streak','composite_score')),
  criteria_threshold NUMERIC NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze'
    CHECK (tier IN ('bronze','silver','gold')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.badge_definitions IS
  'Predefined badge types that officers can earn through performance.';

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badge_definitions_read_all"
  ON public.badge_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "badge_definitions_admin_write"
  ON public.badge_definitions FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- ── officer_badges ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.officer_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_definition_id UUID NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  period_label TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.officer_badges IS
  'Badges earned by loan officers through performance achievements.';

CREATE INDEX IF NOT EXISTS idx_officer_badges_user
  ON public.officer_badges (user_id, earned_at DESC);

ALTER TABLE public.officer_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "officer_badges_admin_all"
  ON public.officer_badges FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "officer_badges_own_select"
  ON public.officer_badges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "officer_badges_bm_select"
  ON public.officer_badges FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = officer_badges.user_id
        AND p.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- ── leaderboard_scores ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leaderboard_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly','monthly')),
  period_label TEXT NOT NULL,
  closed_count INT NOT NULL DEFAULT 0,
  pipeline_volume NUMERIC NOT NULL DEFAULT 0,
  on_time_rate NUMERIC NOT NULL DEFAULT 0,
  conditions_speed_avg_days NUMERIC NOT NULL DEFAULT 0,
  composite_score NUMERIC NOT NULL DEFAULT 0,
  rank INT,
  prev_rank INT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_type, period_label)
);

COMMENT ON TABLE public.leaderboard_scores IS
  'Officer leaderboard scores computed weekly and monthly.';

CREATE INDEX IF NOT EXISTS idx_leaderboard_scores_period
  ON public.leaderboard_scores (period_type, period_label, composite_score DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_scores_user
  ON public.leaderboard_scores (user_id, period_type, period_label);

ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaderboard_admin_all"
  ON public.leaderboard_scores FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "leaderboard_own_select"
  ON public.leaderboard_scores FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "leaderboard_bm_select"
  ON public.leaderboard_scores FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND branch_id = public.user_branch_id(auth.uid())
  );

-- ── Seed badge definitions ───────────────────────────────────────────────────

INSERT INTO public.badge_definitions (slug, name, description, icon_name, criteria_type, criteria_threshold, tier) VALUES
  ('first_close',       'First Close',       'Closed your first loan',                           'trophy',       'closed_count',    1,     'bronze'),
  ('closer_5',          'Steady Closer',     'Closed 5 loans in a single period',                'target',       'closed_count',    5,     'bronze'),
  ('closer_10',         'Top Closer',        'Closed 10 loans in a single period',               'award',        'closed_count',    10,    'silver'),
  ('closer_25',         'Elite Closer',      'Closed 25 loans in a single period',               'crown',        'closed_count',    25,    'gold'),
  ('pipeline_1m',       'Million Dollar Pipeline', 'Pipeline volume exceeded $1M',               'dollar-sign',  'pipeline_volume', 1000000, 'bronze'),
  ('pipeline_5m',       'Pipeline King',     'Pipeline volume exceeded $5M',                     'gem',          'pipeline_volume', 5000000, 'silver'),
  ('pipeline_10m',      'Pipeline Legend',   'Pipeline volume exceeded $10M',                    'sparkles',     'pipeline_volume', 10000000,'gold'),
  ('perfect_month',     'Perfect Month',     '100% on-time close rate in a month',               'shield-check', 'on_time_rate',    100,   'gold'),
  ('speed_demon',       'Speed Demon',       'Average conditions cleared in under 3 days',       'zap',          'conditions_speed', 3,    'silver'),
  ('top_performer',     'Top Performer',     'Composite score above 80',                         'star',         'composite_score', 80,    'gold')
ON CONFLICT (slug) DO NOTHING;
