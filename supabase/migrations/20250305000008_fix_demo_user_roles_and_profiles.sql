-- Fix: Ensure core demo users have correct profiles and roles.
--
-- Affected emails (from setup docs and scripts/setup-demo-users.ts):
--   - admin@collabai.software       -> app_role = 'admin',     full_name = 'Superadmin'
--   - moderator@collabai.software   -> app_role = 'moderator', full_name = 'Moderator User'
--   - demo@collabai.software        -> app_role = 'user',      full_name = 'Demo User'
--   - loanofficer@collabai.software -> app_role = 'user',      full_name = 'Loan Officer'
--   - branchmanager@collabai.software -> app_role = 'user',    full_name = 'Branch Manager'
--
-- This migration:
--   1. Ensures there is a profiles row for each of these emails with the
--      expected full_name (without overwriting avatar_url or metadata).
--   2. Ensures there is a user_roles row for each auth user, with the correct
--      app_role. For existing rows, only the role column is updated so that
--      custom_role_id (loan officer / branch manager custom roles) is preserved.
--
-- Safe to re-run: uses INSERT ... ON CONFLICT / UPDATE.

-- =============================================================================
-- 1. Ensure profiles exist with correct full_name
-- =============================================================================
INSERT INTO public.profiles (id, email, full_name, updated_at)
SELECT u.id, u.email,
       CASE u.email
         WHEN 'admin@collabai.software'        THEN 'Superadmin'
         WHEN 'moderator@collabai.software'    THEN 'Moderator User'
         WHEN 'demo@collabai.software'         THEN 'Demo User'
         WHEN 'loanofficer@collabai.software'  THEN 'Loan Officer'
         WHEN 'branchmanager@collabai.software' THEN 'Branch Manager'
       END,
       NOW()
FROM auth.users u
WHERE u.email IN (
  'admin@collabai.software',
  'moderator@collabai.software',
  'demo@collabai.software',
  'loanofficer@collabai.software',
  'branchmanager@collabai.software'
)
ON CONFLICT (id) DO UPDATE
SET
  email      = EXCLUDED.email,
  full_name  = EXCLUDED.full_name,
  updated_at = NOW();

-- =============================================================================
-- 2. Ensure user_roles rows exist with correct app_role
--    (preserve custom_role_id on conflict)
-- =============================================================================

-- Admin
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT u.id, 'admin'::public.app_role, NOW()
FROM auth.users u
WHERE u.email = 'admin@collabai.software'
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;

-- Moderator
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT u.id, 'moderator'::public.app_role, NOW()
FROM auth.users u
WHERE u.email = 'moderator@collabai.software'
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;

-- Demo User
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT u.id, 'user'::public.app_role, NOW()
FROM auth.users u
WHERE u.email = 'demo@collabai.software'
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;

-- Loan Officer (keep app_role as 'user' but ensure row exists)
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT u.id, 'user'::public.app_role, NOW()
FROM auth.users u
WHERE u.email = 'loanofficer@collabai.software'
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;

-- Branch Manager (keep app_role as 'user' but ensure row exists)
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT u.id, 'user'::public.app_role, NOW()
FROM auth.users u
WHERE u.email = 'branchmanager@collabai.software'
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;

