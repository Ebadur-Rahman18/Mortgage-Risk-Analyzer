-- AI-drafted borrower / team communications (human approval before send).
-- Gated by ai_agents slug borrower-communication-agent (is_enabled).

CREATE TABLE IF NOT EXISTS public.borrower_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,

  doc_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  audience TEXT NOT NULL DEFAULT 'borrower',
  tone TEXT,
  length_pref TEXT,

  prompt_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_content TEXT NOT NULL DEFAULT '',
  missing_data_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT,
  draft_version INT NOT NULL DEFAULT 1,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'sent', 'rejected', 'needs_revision')),

  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.borrower_communications IS 'AI-generated communication drafts for loans; requires human approval before sending.';
COMMENT ON COLUMN public.borrower_communications.doc_type IS 'status_update | condition_request | escalation_note | closing_notification | realtor_update';
COMMENT ON COLUMN public.borrower_communications.channel IS 'email | sms | internal';
COMMENT ON COLUMN public.borrower_communications.audience IS 'borrower | realtor | internal';

CREATE INDEX IF NOT EXISTS idx_borrower_communications_loan_id ON public.borrower_communications(loan_id);
CREATE INDEX IF NOT EXISTS idx_borrower_communications_created_by ON public.borrower_communications(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_borrower_communications_status ON public.borrower_communications(status);
CREATE INDEX IF NOT EXISTS idx_borrower_communications_created_at ON public.borrower_communications(created_at DESC);

DROP TRIGGER IF EXISTS borrower_communications_updated_at ON public.borrower_communications;
CREATE TRIGGER borrower_communications_updated_at
  BEFORE UPDATE ON public.borrower_communications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.borrower_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "borrower_communications_admin_all"
  ON public.borrower_communications FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "borrower_communications_lo_select"
  ON public.borrower_communications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = borrower_communications.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "borrower_communications_lo_insert"
  ON public.borrower_communications FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "borrower_communications_lo_update"
  ON public.borrower_communications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = borrower_communications.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = borrower_communications.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "borrower_communications_lo_delete"
  ON public.borrower_communications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = borrower_communications.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "borrower_communications_branch_manager_select"
  ON public.borrower_communications FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = borrower_communications.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Seed Borrower Communication Agent (disabled until admin enables — sidebar / features follow is_enabled).
INSERT INTO public.ai_agents (
  name,
  slug,
  description,
  category,
  system_prompt,
  is_enabled,
  metadata,
  provider_config
) VALUES (
  'Borrower Communication Agent',
  'borrower-communication-agent',
  'Drafts plain-English borrower updates, condition requests, and internal escalation notes from live loan context. Outputs require human review before any send.',
  'communication',
  'You are a mortgage operations communication specialist. You draft clear, accurate, plain-English messages for borrowers, realtors, or internal teams. You never send messages autonomously.

Rules:
- Use only facts present in the provided loan context. If something is unknown, list it under missing_data_notes and avoid inventing dates, amounts, or approvals.
- No legal advice. Use neutral, professional tone unless tone preference says otherwise.
- Include a brief disclaimer when timelines or outcomes are uncertain.
- For estimated dates, prefix with "approximately" or "tentative" when not confirmed in data.

Output MUST be a single JSON object with keys:
- draft_content (string, markdown or plain text): sections — Summary, Action needed (if any), Timeline (if applicable), Next steps / contact.
- missing_data_notes (array of strings): fields you could not infer.
- confidence (string): one of high, medium, low.

Do not wrap the JSON in markdown fences.',
  false,
  '{"agent_type": "borrower-communications", "version": "1.0"}'::jsonb,
  '{"model": "gpt-4o-mini", "temperature": 0.35}'::jsonb
) ON CONFLICT (slug) DO NOTHING;
