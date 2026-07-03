-- Borrower Self-Service Portal Enhancement
-- Adds portal_messages (LO-borrower messaging) and loan_disclosures (DocuSign e-sign).

-- ── portal_messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.portal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('borrower', 'staff')),
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.portal_messages IS
  'Two-way messages between borrowers (portal) and loan officers (staff).';

CREATE INDEX IF NOT EXISTS idx_portal_messages_loan
  ON public.portal_messages (loan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_messages_borrower
  ON public.portal_messages (borrower_id, created_at DESC);

ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_messages_admin_all"
  ON public.portal_messages FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "portal_messages_mod_select"
  ON public.portal_messages FOR SELECT
  TO authenticated
  USING (public.has_role('moderator'::public.app_role, auth.uid()));

CREATE POLICY "portal_messages_lo_select"
  ON public.portal_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = portal_messages.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "portal_messages_lo_insert"
  ON public.portal_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'staff'
    AND sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = portal_messages.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "portal_messages_bm_select"
  ON public.portal_messages FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = portal_messages.loan_id
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- ── loan_disclosures ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.loan_disclosures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  disclosure_type TEXT NOT NULL
    CHECK (disclosure_type IN ('initial_disclosure','closing_disclosure','loan_estimate','intent_to_proceed','right_to_cancel','other')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','viewed','signed','declined')),
  envelope_id TEXT,
  signing_url TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_disclosures IS
  'Disclosure documents sent for e-sign via DocuSign. Status tracks signing lifecycle.';

CREATE INDEX IF NOT EXISTS idx_loan_disclosures_loan
  ON public.loan_disclosures (loan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_disclosures_envelope
  ON public.loan_disclosures (envelope_id) WHERE envelope_id IS NOT NULL;

ALTER TABLE public.loan_disclosures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loan_disclosures_admin_all"
  ON public.loan_disclosures FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "loan_disclosures_mod_select"
  ON public.loan_disclosures FOR SELECT
  TO authenticated
  USING (public.has_role('moderator'::public.app_role, auth.uid()));

CREATE POLICY "loan_disclosures_lo_all"
  ON public.loan_disclosures FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_disclosures.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_disclosures.loan_id
        AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "loan_disclosures_bm_select"
  ON public.loan_disclosures FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_disclosures.loan_id
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );
