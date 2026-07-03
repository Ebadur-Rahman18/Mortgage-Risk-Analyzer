-- Own user_roles rows must be readable without calling has_role().
-- Policies that OR has_role(...) fail entirely if has_role is not executable,
-- which blocks profile.role loading and admin route access.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_write_admin" ON public.user_roles;

-- Every authenticated user can read their own role row(s).
CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all role rows (User Management, etc.).
CREATE POLICY "user_roles_select_admin"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins can insert/update/delete role assignments.
CREATE POLICY "user_roles_write_admin"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
