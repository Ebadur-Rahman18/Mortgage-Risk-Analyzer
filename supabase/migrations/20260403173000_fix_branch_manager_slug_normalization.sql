-- Normalize branch manager slug checks across hyphen/space/underscore variants.
-- This fixes RLS checks when roles.slug is "branch-manager" instead of "branch_manager".

CREATE OR REPLACE FUNCTION public.is_branch_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.custom_role_id = r.id
    WHERE ur.user_id = _user_id
      AND regexp_replace(lower(coalesce(r.slug, '')), '[\s-]+', '_', 'g') = 'branch_manager'
  );
$$;

COMMENT ON FUNCTION public.is_branch_manager IS
  'Returns true if user has branch manager custom role (supports slug variants like branch_manager and branch-manager).';
