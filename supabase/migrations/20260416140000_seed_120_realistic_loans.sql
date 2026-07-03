-- Seed 120 realistic loans across multiple officers, branches, statuses,
-- risk levels, and activity ages so every dashboard section has data.
-- Safe to re-run: uses ON CONFLICT / IF NOT EXISTS guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  -- Officers (reuse existing + create new)
  lo1 UUID;  -- loanofficer@collabai.software (existing)
  lo2 UUID;  -- mlo_sarah
  lo3 UUID;  -- mlo_james
  lo4 UUID;  -- mlo_maria
  lo5 UUID;  -- mlo_kevin
  lo6 UUID;  -- mlo_priya

  -- Branches
  br_midtown UUID;
  br_brooklyn UUID;
  br_astoria  UUID;

  -- Helpers
  i INT;
  b_id UUID;
  officer UUID;
  borrow_id UUID;
  loan_uid UUID;
  loan_num TEXT;
  borrow_email TEXT;
  loan_status TEXT;
  loan_amt DECIMAL(15,2);
  prop_addr TEXT;
  prop_city TEXT;
  prop_state TEXT;
  prop_zip TEXT;
  credit INT;
  ltv_val DECIMAL(5,2);
  dti_val DECIMAL(5,2);
  risk_lvl TEXT;
  risk_score INT;
  days_stale INT;
  created_ts TIMESTAMPTZ;
  updated_ts TIMESTAMPTZ;
  lock_exp DATE;
  purposes TEXT[] := ARRAY['purchase','refinance','cash_out_refinance','home_equity'];
  statuses TEXT[] := ARRAY[
    'draft','application','submitted','processing','underwriting',
    'conditional_approval','clear_to_close','docs_out','funding',
    'closed','denied','withdrawn'
  ];
BEGIN

  -- ================================================================
  -- 1. Look up branches
  -- ================================================================
  SELECT id INTO br_midtown FROM public.branches WHERE code = 'midtown_manhattan';
  SELECT id INTO br_brooklyn FROM public.branches WHERE code = 'brooklyn';
  SELECT id INTO br_astoria  FROM public.branches WHERE code = 'astoria';

  IF br_midtown IS NULL OR br_brooklyn IS NULL OR br_astoria IS NULL THEN
    RAISE NOTICE 'Missing branches — inserting defaults';
    INSERT INTO public.branches (name, code, is_active)
    VALUES ('Midtown Manhattan','midtown_manhattan',true),
           ('Brooklyn','brooklyn',true),
           ('Astoria','astoria',true)
    ON CONFLICT (code) DO NOTHING;
    SELECT id INTO br_midtown FROM public.branches WHERE code = 'midtown_manhattan';
    SELECT id INTO br_brooklyn FROM public.branches WHERE code = 'brooklyn';
    SELECT id INTO br_astoria  FROM public.branches WHERE code = 'astoria';
  END IF;

  -- ================================================================
  -- 2. Look up / create loan officers
  -- ================================================================
  SELECT id INTO lo1 FROM auth.users WHERE email = 'loanofficer@collabai.software';

  -- Helper: create MLO users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sarah.mlo@collabai.software') THEN
    lo2 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo2,'00000000-0000-0000-0000-000000000000','sarah.mlo@collabai.software',extensions.crypt('SarahMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"Sarah Mitchell"}',now(),now(),'authenticated','authenticated',false);
  END IF;
  SELECT id INTO lo2 FROM auth.users WHERE email = 'sarah.mlo@collabai.software';
  INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo2,'sarah.mlo@collabai.software','Sarah Mitchell',br_midtown) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id,role) VALUES (lo2,'user') ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'james.mlo@collabai.software') THEN
    lo3 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo3,'00000000-0000-0000-0000-000000000000','james.mlo@collabai.software',extensions.crypt('JamesMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"James Cooper"}',now(),now(),'authenticated','authenticated',false);
  END IF;
  SELECT id INTO lo3 FROM auth.users WHERE email = 'james.mlo@collabai.software';
  INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo3,'james.mlo@collabai.software','James Cooper',br_midtown) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id,role) VALUES (lo3,'user') ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'maria.mlo@collabai.software') THEN
    lo4 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo4,'00000000-0000-0000-0000-000000000000','maria.mlo@collabai.software',extensions.crypt('MariaMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"Maria Santos"}',now(),now(),'authenticated','authenticated',false);
  END IF;
  SELECT id INTO lo4 FROM auth.users WHERE email = 'maria.mlo@collabai.software';
  INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo4,'maria.mlo@collabai.software','Maria Santos',br_brooklyn) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id,role) VALUES (lo4,'user') ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'kevin.mlo@collabai.software') THEN
    lo5 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo5,'00000000-0000-0000-0000-000000000000','kevin.mlo@collabai.software',extensions.crypt('KevinMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"Kevin Tran"}',now(),now(),'authenticated','authenticated',false);
  END IF;
  SELECT id INTO lo5 FROM auth.users WHERE email = 'kevin.mlo@collabai.software';
  INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo5,'kevin.mlo@collabai.software','Kevin Tran',br_brooklyn) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id,role) VALUES (lo5,'user') ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'priya.mlo@collabai.software') THEN
    lo6 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo6,'00000000-0000-0000-0000-000000000000','priya.mlo@collabai.software',extensions.crypt('PriyaMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"Priya Desai"}',now(),now(),'authenticated','authenticated',false);
  END IF;
  SELECT id INTO lo6 FROM auth.users WHERE email = 'priya.mlo@collabai.software';
  INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo6,'priya.mlo@collabai.software','Priya Desai',br_astoria) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id,role) VALUES (lo6,'user') ON CONFLICT (user_id) DO NOTHING;

  -- Also assign existing LO to midtown if not already
  IF lo1 IS NOT NULL THEN
    UPDATE public.profiles SET branch_id = br_midtown WHERE id = lo1 AND branch_id IS NULL;
  END IF;

  -- ================================================================
  -- 3. Generate 120 loans with borrowers, risk scores, rate locks
  -- ================================================================
  FOR i IN 1..120 LOOP
    -- Skip if loan number already exists
    loan_num := 'LN-2026-' || LPAD(i::TEXT, 4, '0');
    IF EXISTS (SELECT 1 FROM public.loans WHERE loan_number = loan_num) THEN
      CONTINUE;
    END IF;

    -- Round-robin officer assignment with weighted distribution
    CASE (i % 6)
      WHEN 0 THEN officer := lo1; b_id := br_midtown;
      WHEN 1 THEN officer := lo2; b_id := br_midtown;
      WHEN 2 THEN officer := lo3; b_id := br_midtown;
      WHEN 3 THEN officer := lo4; b_id := br_brooklyn;
      WHEN 4 THEN officer := lo5; b_id := br_brooklyn;
      WHEN 5 THEN officer := lo6; b_id := br_astoria;
    END CASE;

    IF officer IS NULL THEN
      officer := lo2; b_id := br_midtown;
    END IF;

    -- Borrower
    borrow_email := 'borrower.seed' || i || '@example.com';
    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = borrow_email) THEN
      INSERT INTO public.borrowers (first_name, last_name, email, phone, city, state, postal_code, data_source, created_by)
      VALUES (
        CASE (i % 10)
          WHEN 0 THEN 'Michael' WHEN 1 THEN 'Jennifer' WHEN 2 THEN 'Robert'
          WHEN 3 THEN 'Amanda'  WHEN 4 THEN 'David'    WHEN 5 THEN 'Jessica'
          WHEN 6 THEN 'Carlos'  WHEN 7 THEN 'Samantha'  WHEN 8 THEN 'William'
          ELSE 'Emily'
        END,
        CASE (i % 12)
          WHEN 0  THEN 'Johnson'  WHEN 1  THEN 'Williams' WHEN 2  THEN 'Brown'
          WHEN 3  THEN 'Garcia'   WHEN 4  THEN 'Martinez' WHEN 5  THEN 'Davis'
          WHEN 6  THEN 'Rodriguez' WHEN 7 THEN 'Chen'     WHEN 8  THEN 'Patel'
          WHEN 9  THEN 'Kim'      WHEN 10 THEN 'Nguyen'   ELSE 'Thompson'
        END,
        borrow_email,
        '555-' || LPAD((3000 + i)::TEXT, 4, '0'),
        CASE (i % 5)
          WHEN 0 THEN 'New York'  WHEN 1 THEN 'Brooklyn'
          WHEN 2 THEN 'Queens'    WHEN 3 THEN 'Bronx'
          ELSE 'Manhattan'
        END,
        'NY',
        CASE (i % 5)
          WHEN 0 THEN '10001' WHEN 1 THEN '11201'
          WHEN 2 THEN '11101' WHEN 3 THEN '10451'
          ELSE '10019'
        END,
        'manual',
        officer
      );
    END IF;
    SELECT id INTO borrow_id FROM public.borrowers WHERE email = borrow_email;
    IF borrow_id IS NULL THEN CONTINUE; END IF;

    -- Loan status distribution: realistic pipeline
    -- 10 draft, 15 application, 12 submitted, 18 processing, 15 underwriting,
    -- 10 conditional_approval, 8 clear_to_close, 5 docs_out, 5 funding,
    -- 15 closed, 4 denied, 3 withdrawn
    CASE
      WHEN i <= 10  THEN loan_status := 'draft';
      WHEN i <= 25  THEN loan_status := 'application';
      WHEN i <= 37  THEN loan_status := 'submitted';
      WHEN i <= 55  THEN loan_status := 'processing';
      WHEN i <= 70  THEN loan_status := 'underwriting';
      WHEN i <= 80  THEN loan_status := 'conditional_approval';
      WHEN i <= 88  THEN loan_status := 'clear_to_close';
      WHEN i <= 93  THEN loan_status := 'docs_out';
      WHEN i <= 98  THEN loan_status := 'funding';
      WHEN i <= 113 THEN loan_status := 'closed';
      WHEN i <= 117 THEN loan_status := 'denied';
      ELSE               loan_status := 'withdrawn';
    END CASE;

    -- Loan amount ($150K - $1.2M)
    loan_amt := 150000 + (i * 8700) + ((i % 7) * 15000);

    -- Credit score (620-820)
    credit := 620 + ((i * 17) % 200);

    -- LTV (55-97%)
    ltv_val := 55 + ((i * 3) % 42);

    -- DTI (18-55%)
    dti_val := 18 + ((i * 2) % 37);

    -- Property
    prop_addr := (100 + i * 3)::TEXT || CASE (i % 4)
      WHEN 0 THEN ' Park Avenue' WHEN 1 THEN ' Broadway'
      WHEN 2 THEN ' Atlantic Ave' ELSE ' Steinway St'
    END;
    prop_city := CASE (i % 5)
      WHEN 0 THEN 'New York'  WHEN 1 THEN 'Brooklyn'
      WHEN 2 THEN 'Queens'    WHEN 3 THEN 'Bronx'
      ELSE 'Manhattan'
    END;
    prop_state := 'NY';
    prop_zip := CASE (i % 5)
      WHEN 0 THEN '10001' WHEN 1 THEN '11201'
      WHEN 2 THEN '11101' WHEN 3 THEN '10451'
      ELSE '10019'
    END;

    -- Staleness: create varied updated_at dates for inactivity aging
    -- ~25 loans: untouched 21+ days (escalation territory)
    -- ~30 loans: untouched 7-20 days (reminder territory)
    -- ~40 loans: touched within 7 days (active)
    -- ~25 loans: closed/denied/withdrawn (terminal, various ages)
    CASE
      WHEN i <= 12  THEN days_stale := 25 + (i % 20);   -- 25-44 days stale
      WHEN i <= 25  THEN days_stale := 21 + (i % 8);    -- 21-28 days stale
      WHEN i <= 55  THEN days_stale := 7 + (i % 14);    -- 7-20 days stale
      WHEN i <= 95  THEN days_stale := (i % 6);          -- 0-5 days (active)
      ELSE               days_stale := 3 + (i % 45);     -- terminal: varied
    END CASE;

    created_ts := now() - ((days_stale + 15 + (i % 30))::TEXT || ' days')::INTERVAL;
    updated_ts := now() - (days_stale::TEXT || ' days')::INTERVAL;

    -- Lock expiration for some active loans
    IF loan_status IN ('processing','underwriting','conditional_approval','clear_to_close') AND i % 3 = 0 THEN
      lock_exp := (CURRENT_DATE + ((i % 12) - 2)::INT);
    ELSE
      lock_exp := NULL;
    END IF;

    -- Insert loan
    loan_uid := gen_random_uuid();
    INSERT INTO public.loans (
      id, loan_number, borrower_id, loan_officer_id, status,
      loan_amount, credit_score, ltv, dti,
      purpose, occupancy_type,
      property_address, property_city, property_state, property_postal_code,
      lock_expiration_date, branch_id,
      created_at, updated_at, data_source
    ) VALUES (
      loan_uid, loan_num, borrow_id, officer, loan_status,
      loan_amt, credit, ltv_val, dti_val,
      purposes[1 + (i % 4)],
      CASE (i % 3) WHEN 0 THEN 'primary_residence' WHEN 1 THEN 'second_home' ELSE 'investment' END,
      prop_addr, prop_city, prop_state, prop_zip,
      lock_exp, b_id,
      created_ts, updated_ts, 'manual'
    );

    -- Risk score: distribute across levels
    CASE
      WHEN i % 11 = 0 THEN risk_lvl := 'critical'; risk_score := 80 + (i % 20);
      WHEN i % 7  = 0 THEN risk_lvl := 'high';     risk_score := 60 + (i % 20);
      WHEN i % 3  = 0 THEN risk_lvl := 'medium';    risk_score := 35 + (i % 25);
      ELSE                  risk_lvl := 'low';       risk_score := 5 + (i % 30);
    END CASE;

    INSERT INTO public.loan_risk_scores (
      loan_id, overall_risk_score, risk_level, risk_factors,
      stall_risk, lock_expiry_risk, condition_risk,
      calculated_at
    ) VALUES (
      loan_uid, LEAST(risk_score, 100), risk_lvl,
      CASE risk_lvl
        WHEN 'critical' THEN '[{"factor":"High DTI","weight":0.4},{"factor":"Stale file","weight":0.6}]'::jsonb
        WHEN 'high'     THEN '[{"factor":"Lock expiring","weight":0.5},{"factor":"Low credit","weight":0.5}]'::jsonb
        WHEN 'medium'   THEN '[{"factor":"Incomplete docs","weight":1.0}]'::jsonb
        ELSE '[]'::jsonb
      END,
      CASE WHEN days_stale > 14 THEN LEAST(days_stale * 3, 100) ELSE days_stale * 2 END,
      CASE WHEN lock_exp IS NOT NULL AND lock_exp <= CURRENT_DATE + 5 THEN 80 ELSE 10 END,
      CASE WHEN risk_lvl IN ('high','critical') THEN 60 + (i % 30) ELSE 10 + (i % 20) END,
      updated_ts
    ) ON CONFLICT (loan_id) DO NOTHING;

    -- Rate locks for loans with lock_expiration_date
    IF lock_exp IS NOT NULL THEN
      INSERT INTO public.rate_locks (
        loan_id, branch_id, product_name, locked_rate,
        lock_date, lock_expiration, lock_term_days,
        locked_by_user_id, status
      ) VALUES (
        loan_uid, b_id,
        CASE (i % 3) WHEN 0 THEN '30yr Fixed' WHEN 1 THEN '15yr Fixed' ELSE '7/1 ARM' END,
        5.5 + ((i % 15)::DECIMAL / 10),
        CURRENT_DATE - 30,
        lock_exp,
        CASE (i % 3) WHEN 0 THEN 30 WHEN 1 THEN 45 ELSE 60 END,
        officer,
        'active'
      );
    END IF;

    -- Timeline event: status_change
    INSERT INTO public.loan_timeline_events (
      loan_id, event_type, event_source, title, description,
      occurred_at, created_by
    ) VALUES (
      loan_uid, 'status_change', 'system',
      'Status set to ' || loan_status,
      'Loan ' || loan_num || ' moved to ' || loan_status || ' stage.',
      updated_ts, officer
    );

  END LOOP;

  RAISE NOTICE 'Seed complete: up to 120 loans with borrowers, risk scores, rate locks, and timeline events.';
END $$;
