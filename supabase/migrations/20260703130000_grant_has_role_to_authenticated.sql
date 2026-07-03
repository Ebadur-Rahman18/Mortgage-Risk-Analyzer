-- Fix admin access: migration 20260526200000 revoked EXECUTE on has_role from PUBLIC,
-- which also removed access for the authenticated role. RLS policies that call
-- has_role(...) then fail for normal users, so user_roles (and admin checks) break.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
