-- Branches: organizational units for grouping users and loans.
-- Branch Managers see all loans in their branch.

-- =============================================================================
-- 1. Branches table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) UNIQUE,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.branches IS 'Organizational branches. Users and loans belong to a branch.';

CREATE INDEX IF NOT EXISTS idx_branches_code ON public.branches(code);
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON public.branches(is_active);

DROP TRIGGER IF EXISTS branches_updated_at ON public.branches;
CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: all authenticated can read; only admins can mutate
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_select_authenticated" ON public.branches;
CREATE POLICY "branches_select_authenticated"
  ON public.branches FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "branches_admin_all" ON public.branches;
CREATE POLICY "branches_admin_all"
  ON public.branches FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- =============================================================================
-- 2. Add branch_id to profiles and loans
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.branch_id IS 'Branch this user belongs to. Used for Branch Manager RLS scoping.';

CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles(branch_id);

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.loans.branch_id IS 'Branch this loan belongs to. Typically inherited from the loan officer branch at creation.';

CREATE INDEX IF NOT EXISTS idx_loans_branch_id ON public.loans(branch_id);

-- =============================================================================
-- 3. Seed Branch Manager and Loan Officer custom roles
-- =============================================================================
INSERT INTO public.roles (name, slug, description, is_system, display_order)
VALUES
  ('Branch Manager', 'branch_manager', 'Can view all loans, conditions, and risk for their branch', true, 20),
  ('Loan Officer', 'loan_officer', 'Creates and manages their own loans', true, 30)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 4. Helper functions for RLS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_branch_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.custom_role_id = r.id
    WHERE ur.user_id = _user_id AND r.slug = 'branch_manager'
  );
$$;

COMMENT ON FUNCTION public.is_branch_manager IS 'Returns true if user has the branch_manager custom role.';

CREATE OR REPLACE FUNCTION public.user_branch_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT branch_id FROM public.profiles WHERE id = _user_id;
$$;

COMMENT ON FUNCTION public.user_branch_id IS 'Returns the branch_id from profiles for the given user.';

-- =============================================================================
-- 5. Branch Manager RLS policy for existing loans table
-- =============================================================================
DROP POLICY IF EXISTS "loans_branch_manager_select" ON public.loans;
CREATE POLICY "loans_branch_manager_select"
  ON public.loans FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND branch_id IS NOT NULL
    AND branch_id = public.user_branch_id(auth.uid())
  );
