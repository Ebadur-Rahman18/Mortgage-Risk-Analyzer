-- Borrower portal: magic-link invites, borrower uploads (private storage), staff review.
-- Borrowers do not use Supabase Auth; portal access is JWT from edge after redeeming invite.

-- =============================================================================
-- 1. Invites (raw token shown once; only token_hash stored)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.borrower_portal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_ip TEXT
);

COMMENT ON TABLE public.borrower_portal_invites IS 'One-time magic link tokens for borrower portal access; store only SHA-256 hash of token.';

CREATE INDEX IF NOT EXISTS idx_borrower_portal_invites_loan_id ON public.borrower_portal_invites(loan_id);
CREATE INDEX IF NOT EXISTS idx_borrower_portal_invites_expires_at ON public.borrower_portal_invites(expires_at);

-- =============================================================================
-- 2. Uploads from portal (metadata + storage path)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.loan_borrower_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  loan_condition_id UUID REFERENCES public.loan_conditions(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_status TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  source TEXT NOT NULL DEFAULT 'portal',
  CONSTRAINT loan_borrower_uploads_review_status_check CHECK (
    review_status = ANY (ARRAY['pending_review'::text, 'accepted'::text, 'rejected'::text])
  ),
  CONSTRAINT loan_borrower_uploads_source_check CHECK (source = 'portal')
);

COMMENT ON TABLE public.loan_borrower_uploads IS 'Files submitted by borrowers via portal; binary in storage bucket loan-borrower-uploads.';
CREATE INDEX IF NOT EXISTS idx_loan_borrower_uploads_loan_id ON public.loan_borrower_uploads(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_borrower_uploads_review_status ON public.loan_borrower_uploads(review_status);

-- =============================================================================
-- 3. Lightweight audit (optional compliance trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.borrower_portal_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  borrower_id UUID REFERENCES public.borrowers(id) ON DELETE SET NULL,
  invite_id UUID REFERENCES public.borrower_portal_invites(id) ON DELETE SET NULL,
  upload_id UUID REFERENCES public.loan_borrower_uploads(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.borrower_portal_audit IS 'Portal security events: redeem, upload, etc. Written by edge functions (service role).';
CREATE INDEX IF NOT EXISTS idx_borrower_portal_audit_loan_id ON public.borrower_portal_audit(loan_id);
CREATE INDEX IF NOT EXISTS idx_borrower_portal_audit_created_at ON public.borrower_portal_audit(created_at DESC);

-- =============================================================================
-- 4. Storage bucket (private; access via service role in edge functions)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-borrower-uploads',
  'loan-borrower-uploads',
  false,
  26214400,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects policies for authenticated users — service role bypasses RLS.

-- =============================================================================
-- 5. RLS: invites & uploads & audit
-- =============================================================================
ALTER TABLE public.borrower_portal_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_borrower_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrower_portal_audit ENABLE ROW LEVEL SECURITY;

-- Admins
CREATE POLICY "borrower_portal_invites_admin_all"
  ON public.borrower_portal_invites FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "loan_borrower_uploads_admin_all"
  ON public.loan_borrower_uploads FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "borrower_portal_audit_admin_select"
  ON public.borrower_portal_audit FOR SELECT
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()));

-- Loan officer: invites for own loans
CREATE POLICY "borrower_portal_invites_lo_select"
  ON public.borrower_portal_invites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = borrower_portal_invites.loan_id AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "borrower_portal_invites_lo_insert"
  ON public.borrower_portal_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = borrower_portal_invites.loan_id
        AND l.loan_officer_id = auth.uid()
        AND l.borrower_id = borrower_portal_invites.borrower_id
    )
  );

-- Branch manager: read invites for branch loans
CREATE POLICY "borrower_portal_invites_bm_select"
  ON public.borrower_portal_invites FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = borrower_portal_invites.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Loan officer: uploads on own loans
CREATE POLICY "loan_borrower_uploads_lo_select"
  ON public.loan_borrower_uploads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_borrower_uploads.loan_id AND l.loan_officer_id = auth.uid()
    )
  );

CREATE POLICY "loan_borrower_uploads_lo_update"
  ON public.loan_borrower_uploads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_borrower_uploads.loan_id AND l.loan_officer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_borrower_uploads.loan_id AND l.loan_officer_id = auth.uid()
    )
  );

-- Branch manager: read uploads in branch
CREATE POLICY "loan_borrower_uploads_bm_select"
  ON public.loan_borrower_uploads FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_borrower_uploads.loan_id
        AND l.branch_id IS NOT NULL
        AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Moderator: read all uploads (align with communications)
CREATE POLICY "loan_borrower_uploads_moderator_select"
  ON public.loan_borrower_uploads FOR SELECT
  TO authenticated
  USING (public.has_role('moderator'::public.app_role, auth.uid()));

CREATE POLICY "loan_borrower_uploads_moderator_update"
  ON public.loan_borrower_uploads FOR UPDATE
  TO authenticated
  USING (public.has_role('moderator'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('moderator'::public.app_role, auth.uid()));

-- Audit: no insert/select for non-admin from client (edge uses service role)
