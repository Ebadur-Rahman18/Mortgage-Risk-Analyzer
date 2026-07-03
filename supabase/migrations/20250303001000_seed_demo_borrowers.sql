-- Seed demo borrowers for testing loan officer scoping.
-- 
-- Creates:
--   - User:  Nadeem (email: nadeem@collabai.software, password: Nadeem@123)
--   - 5 borrowers created_by Nadeem
--   - 10 borrowers created_by loanofficer@collabai.software
--
-- Safe to re-run: uses IF NOT EXISTS guards for users, profiles, roles, and
-- idempotent checks on borrower emails.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  nadeem_id        UUID;
  loan_officer_id  UUID;
BEGIN
  -- ------------------------------------------------------------------------
  -- 1. Ensure Nadeem user exists (standard non-admin / loan officer role)
  -- ------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'nadeem@collabai.software') THEN
    nadeem_id := gen_random_uuid();
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
      nadeem_id,
      '00000000-0000-0000-0000-000000000000',
      'nadeem@collabai.software',
      extensions.crypt('Nadeem@123', extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Nadeem"}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      false
    );
  END IF;

  SELECT id INTO nadeem_id FROM auth.users WHERE email = 'nadeem@collabai.software';
  IF nadeem_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (nadeem_id, 'nadeem@collabai.software', 'Nadeem')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (nadeem_id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- ------------------------------------------------------------------------
  -- 2. Fetch existing Loan Officer user id
  -- ------------------------------------------------------------------------
  SELECT id INTO loan_officer_id FROM auth.users WHERE email = 'loanofficer@collabai.software';

  -- ------------------------------------------------------------------------
  -- 3. Seed 5 borrowers created by Nadeem
  -- ------------------------------------------------------------------------
  IF nadeem_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'nadeem.borrower1@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower One (Nadeem)', 'nadeem.borrower1@example.com', '555-1001', 'Austin', 'TX', '73301', 'manual', nadeem_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'nadeem.borrower2@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Two (Nadeem)', 'nadeem.borrower2@example.com', '555-1002', 'Austin', 'TX', '73301', 'manual', nadeem_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'nadeem.borrower3@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Three (Nadeem)', 'nadeem.borrower3@example.com', '555-1003', 'Dallas', 'TX', '75001', 'manual', nadeem_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'nadeem.borrower4@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Four (Nadeem)', 'nadeem.borrower4@example.com', '555-1004', 'Houston', 'TX', '77001', 'manual', nadeem_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'nadeem.borrower5@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Five (Nadeem)', 'nadeem.borrower5@example.com', '555-1005', 'San Antonio', 'TX', '78201', 'manual', nadeem_id);
    END IF;
  END IF;

  -- ------------------------------------------------------------------------
  -- 4. Seed 10 borrowers created by Loan Officer
  -- ------------------------------------------------------------------------
  IF loan_officer_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower1@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower One (LO)', 'loanofficer.borrower1@example.com', '555-2001', 'Miami', 'FL', '33101', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower2@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Two (LO)', 'loanofficer.borrower2@example.com', '555-2002', 'Miami', 'FL', '33101', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower3@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Three (LO)', 'loanofficer.borrower3@example.com', '555-2003', 'Orlando', 'FL', '32801', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower4@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Four (LO)', 'loanofficer.borrower4@example.com', '555-2004', 'Orlando', 'FL', '32801', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower5@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Five (LO)', 'loanofficer.borrower5@example.com', '555-2005', 'Tampa', 'FL', '33601', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower6@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Six (LO)', 'loanofficer.borrower6@example.com', '555-2006', 'Tampa', 'FL', '33601', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower7@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Seven (LO)', 'loanofficer.borrower7@example.com', '555-2007', 'Jacksonville', 'FL', '32201', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower8@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Eight (LO)', 'loanofficer.borrower8@example.com', '555-2008', 'Jacksonville', 'FL', '32201', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower9@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Nine (LO)', 'loanofficer.borrower9@example.com', '555-2009', 'Fort Lauderdale', 'FL', '33301', 'manual', loan_officer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = 'loanofficer.borrower10@example.com') THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES ('Demo', 'Borrower Ten (LO)', 'loanofficer.borrower10@example.com', '555-2010', 'Fort Lauderdale', 'FL', '33301', 'manual', loan_officer_id);
    END IF;
  END IF;

END $$;

