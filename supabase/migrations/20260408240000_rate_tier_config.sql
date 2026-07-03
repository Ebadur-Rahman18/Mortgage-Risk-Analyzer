-- ──────────────────────────────────────────────────────────────────────────────
-- Rate Tier Configuration (L6)
--
-- Stores configurable credit-score-to-rate-tier mappings used by the
-- compliance-screening-agent's estimateExpectedRate() function.
--
-- Instead of hardcoded values in the edge function, admins can update these
-- tiers as market rates change without redeploying code.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_tier_config (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Minimum credit score for this tier (inclusive).  Tiers are evaluated
  -- in descending order; the first one whose min_credit_score <= borrower score wins.
  min_credit_score INTEGER     NOT NULL,
  expected_rate    NUMERIC(6,3) NOT NULL,
  label            TEXT,           -- e.g. "Excellent", "Good", "Fair"
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  effective_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rate_tier_config_min_credit_score_unique UNIQUE (min_credit_score)
);

COMMENT ON TABLE public.rate_tier_config IS
  'Credit score tiers → expected rate mappings for compliance rate-deviation checks. '
  'Managed by admins; avoids hardcoding market rates in edge function code.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS rate_tier_config_active_score_idx
  ON public.rate_tier_config (min_credit_score DESC)
  WHERE is_active = true;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.rate_tier_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read tiers (needed by edge functions via service role, UI display)
CREATE POLICY "rate_tier_config_select_authenticated"
  ON public.rate_tier_config FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert / update / delete
CREATE POLICY "rate_tier_config_admin_insert"
  ON public.rate_tier_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "rate_tier_config_admin_update"
  ON public.rate_tier_config FOR UPDATE
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "rate_tier_config_admin_delete"
  ON public.rate_tier_config FOR DELETE
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()));

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_rate_tier_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rate_tier_config_updated_at
  BEFORE UPDATE ON public.rate_tier_config
  FOR EACH ROW EXECUTE FUNCTION public.update_rate_tier_config_updated_at();

-- ── Seed default tiers (matching former hardcoded values) ─────────────────────
-- These reflect typical 30-year conventional rates; admins should update them
-- to match actual market conditions.

INSERT INTO public.rate_tier_config (min_credit_score, expected_rate, label) VALUES
  (760, 6.500, 'Exceptional'),
  (740, 6.625, 'Very Good'),
  (720, 6.750, 'Good'),
  (700, 6.875, 'Above Average'),
  (680, 7.000, 'Average'),
  (660, 7.250, 'Below Average'),
  (640, 7.500, 'Fair'),
  (  0, 7.750, 'Poor')
ON CONFLICT (min_credit_score) DO NOTHING;
