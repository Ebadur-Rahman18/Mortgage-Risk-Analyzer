-- Allow assigning a custom role (from roles table) to a user in addition to app_role.
-- app_role (admin/moderator/user) controls access; custom_role_id is for display and permission templates.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_roles.custom_role_id IS 'Optional custom role from roles table (e.g. Manager, Editor). When set, user has this role for display/permissions; app_role still used for admin access.';
