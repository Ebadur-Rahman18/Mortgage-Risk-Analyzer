-- Seed demo users: Loan Officer and Branch Manager
-- Emails:    loanofficer@collabai.software  /  branchmanager@collabai.software
-- Passwords: LoanOfficer@123               /  BranchManager@123
--
-- app_role is set to 'user' (the standard non-admin role).
-- Uses ON CONFLICT DO NOTHING so the migration is safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  loan_officer_id   UUID;
  branch_manager_id UUID;
BEGIN

  -- ----------------------------------------------------------------
  -- 1. Loan Officer
  -- ----------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'loanofficer@collabai.software') THEN
    loan_officer_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      is_super_admin
    ) VALUES (
      loan_officer_id,
      '00000000-0000-0000-0000-000000000000',
      'loanofficer@collabai.software',
      extensions.crypt('LoanOfficer@123', extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Loan Officer"}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      false
    );
  END IF;

  SELECT id INTO loan_officer_id FROM auth.users WHERE email = 'loanofficer@collabai.software';
  IF loan_officer_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (loan_officer_id, 'loanofficer@collabai.software', 'Loan Officer')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (loan_officer_id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- ----------------------------------------------------------------
  -- 2. Branch Manager
  -- ----------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'branchmanager@collabai.software') THEN
    branch_manager_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      is_super_admin
    ) VALUES (
      branch_manager_id,
      '00000000-0000-0000-0000-000000000000',
      'branchmanager@collabai.software',
      extensions.crypt('BranchManager@123', extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Branch Manager"}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      false
    );
  END IF;

  SELECT id INTO branch_manager_id FROM auth.users WHERE email = 'branchmanager@collabai.software';
  IF branch_manager_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (branch_manager_id, 'branchmanager@collabai.software', 'Branch Manager')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (branch_manager_id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

END $$;
