-- ============================================================================
-- user_invites table + Loan Officer custom role seed
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout)
-- ============================================================================

-- ── 1. user_invites table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_email   ON public.user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_token   ON public.user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires ON public.user_invites(expires_at);

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_invites' AND policyname = 'Admins manage invites'
  ) THEN
    CREATE POLICY "Admins manage invites"
      ON public.user_invites FOR ALL TO authenticated
      USING (public.has_role('admin'::public.app_role, auth.uid()))
      WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));
  END IF;
END $$;

-- ── 2. Ensure branches table has at least one row (required by UserManagement) ─

INSERT INTO public.branches (name, created_at, updated_at)
VALUES ('Main Branch', now(), now())
ON CONFLICT DO NOTHING;

-- ── 3. Seed "Loan Officer" and "Manager" custom roles ──────────────────────
-- roles table (custom roles) — only insert if the rows don't exist yet.
-- These are the display names used in the Invite / Edit User dropdowns.

INSERT INTO public.roles (name, description, permissions)
VALUES
  (
    'Loan Officer',
    'Manages own loan pipeline. Can use AI agents, borrower management, and HubSpot pipeline views.',
    '["loans:read","loans:create","loans:update","borrowers:read","borrowers:create","borrowers:update","tasks:read","tasks:create","tasks:update","tasks:assign","knowledge:read","ai_chat:read","pricing:read","pricing:calculate","rate_locks:read"]'::jsonb
  ),
  (
    'Manager',
    'Branch manager. Full pipeline visibility, all Loan Officer permissions, plus team management.',
    '["loans:read","loans:create","loans:update","loans:delete","borrowers:read","borrowers:create","borrowers:update","tasks:read","tasks:create","tasks:update","tasks:assign","knowledge:read","knowledge:create","ai_chat:read","pricing:read","pricing:calculate","rate_locks:read","rate_locks:manage"]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;
