-- Mortgage Risk Copilot: loan fields, analysis history, chat, loan number trigger.

-- ── 1. Extend loans ──────────────────────────────────────────────────────────

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS annual_income DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS monthly_debt DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS employment_years INT,
  ADD COLUMN IF NOT EXISTS down_payment DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS loan_term_months INT;

COMMENT ON COLUMN public.loans.annual_income IS 'Borrower annual income for Risk Copilot DTI.';
COMMENT ON COLUMN public.loans.monthly_debt IS 'Total monthly debt for Risk Copilot DTI.';
COMMENT ON COLUMN public.loans.employment_years IS 'Years at current employment (Risk Copilot).';
COMMENT ON COLUMN public.loans.down_payment IS 'Down payment amount (Risk Copilot).';
COMMENT ON COLUMN public.loans.loan_term_months IS 'Loan term in months (Risk Copilot).';

-- ── 2. Loan number sequence + trigger (LOAN-YYYY-NNNN) ─────────────────────

CREATE TABLE IF NOT EXISTS public.loan_number_counters (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.generate_loan_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM now())::INT;
  next_num INT;
BEGIN
  IF NEW.loan_number IS NULL OR btrim(NEW.loan_number) = '' THEN
    INSERT INTO public.loan_number_counters (year, last_number)
    VALUES (yr, 1)
    ON CONFLICT (year) DO UPDATE
      SET last_number = public.loan_number_counters.last_number + 1
    RETURNING last_number INTO next_num;
    NEW.loan_number := 'LOAN-' || yr::TEXT || '-' || lpad(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_loan_number ON public.loans;
CREATE TRIGGER trg_generate_loan_number
  BEFORE INSERT ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_loan_number();

-- ── 3. loan_risk_analyses (append-only AI copilot results) ───────────────────

CREATE TABLE IF NOT EXISTS public.loan_risk_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  run_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  risk_score INT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('high', 'medium', 'low')),
  summary TEXT NOT NULL DEFAULT '',
  risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  dti DECIMAL(5,2),
  ltv DECIMAL(5,2),
  model_used TEXT,
  latency_ms INT,
  is_outdated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_risk_analyses IS 'Append-only AI Risk Copilot analyses per loan. Never upserted.';

CREATE INDEX IF NOT EXISTS idx_loan_risk_analyses_loan_created
  ON public.loan_risk_analyses (loan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_risk_analyses_current
  ON public.loan_risk_analyses (loan_id)
  WHERE is_outdated = false;

ALTER TABLE public.loan_risk_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_risk_analyses_admin_all" ON public.loan_risk_analyses;
CREATE POLICY "loan_risk_analyses_admin_all"
  ON public.loan_risk_analyses FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "loan_risk_analyses_lo_select" ON public.loan_risk_analyses;
CREATE POLICY "loan_risk_analyses_lo_select"
  ON public.loan_risk_analyses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_analyses.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "loan_risk_analyses_lo_insert" ON public.loan_risk_analyses;
CREATE POLICY "loan_risk_analyses_lo_insert"
  ON public.loan_risk_analyses FOR INSERT TO authenticated
  WITH CHECK (
    run_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id AND l.loan_officer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "loan_risk_analyses_bm_select" ON public.loan_risk_analyses;
CREATE POLICY "loan_risk_analyses_bm_select"
  ON public.loan_risk_analyses FOR SELECT TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_analyses.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- ── 4. loan_risk_chat_messages ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.loan_risk_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_risk_chat_messages IS 'Per-loan Mortgage Risk Copilot chat history.';

CREATE INDEX IF NOT EXISTS idx_loan_risk_chat_loan_created
  ON public.loan_risk_chat_messages (loan_id, created_at ASC);

ALTER TABLE public.loan_risk_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_risk_chat_admin_all" ON public.loan_risk_chat_messages;
CREATE POLICY "loan_risk_chat_admin_all"
  ON public.loan_risk_chat_messages FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "loan_risk_chat_lo_select" ON public.loan_risk_chat_messages;
CREATE POLICY "loan_risk_chat_lo_select"
  ON public.loan_risk_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_chat_messages.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "loan_risk_chat_lo_insert" ON public.loan_risk_chat_messages;
CREATE POLICY "loan_risk_chat_lo_insert"
  ON public.loan_risk_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id AND l.loan_officer_id = auth.uid()
    )
    AND (role = 'assistant' OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "loan_risk_chat_bm_select" ON public.loan_risk_chat_messages;
CREATE POLICY "loan_risk_chat_bm_select"
  ON public.loan_risk_chat_messages FOR SELECT TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_risk_chat_messages.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- ── 5. Mark analyses outdated when copilot-relevant loan fields change ───────

CREATE OR REPLACE FUNCTION public.mark_loan_risk_analyses_outdated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    OLD.annual_income IS DISTINCT FROM NEW.annual_income OR
    OLD.monthly_debt IS DISTINCT FROM NEW.monthly_debt OR
    OLD.employment_years IS DISTINCT FROM NEW.employment_years OR
    OLD.down_payment IS DISTINCT FROM NEW.down_payment OR
    OLD.loan_term_months IS DISTINCT FROM NEW.loan_term_months OR
    OLD.loan_amount IS DISTINCT FROM NEW.loan_amount OR
    OLD.appraised_value IS DISTINCT FROM NEW.appraised_value OR
    OLD.ltv IS DISTINCT FROM NEW.ltv OR
    OLD.credit_score IS DISTINCT FROM NEW.credit_score OR
    OLD.dti IS DISTINCT FROM NEW.dti OR
    OLD.loan_type IS DISTINCT FROM NEW.loan_type OR
    OLD.interest_rate IS DISTINCT FROM NEW.interest_rate OR
    OLD.property_address IS DISTINCT FROM NEW.property_address OR
    OLD.property_city IS DISTINCT FROM NEW.property_city OR
    OLD.property_state IS DISTINCT FROM NEW.property_state OR
    OLD.property_postal_code IS DISTINCT FROM NEW.property_postal_code OR
    OLD.status IS DISTINCT FROM NEW.status
  ) THEN
    UPDATE public.loan_risk_analyses
    SET is_outdated = true
    WHERE loan_id = NEW.id AND is_outdated = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_loan_risk_analyses_outdated ON public.loans;
CREATE TRIGGER trg_mark_loan_risk_analyses_outdated
  AFTER UPDATE ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_loan_risk_analyses_outdated();

-- ── 6. Module seed ───────────────────────────────────────────────────────────

INSERT INTO public.module_settings (slug, name, description, enabled, display_order)
VALUES (
  'mortgage_risk_copilot',
  'Mortgage Risk Copilot',
  'AI-driven mortgage risk analysis, chat, and dashboard on loan files',
  true,
  35
)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      enabled = EXCLUDED.enabled,
      display_order = EXCLUDED.display_order,
      updated_at = now();
