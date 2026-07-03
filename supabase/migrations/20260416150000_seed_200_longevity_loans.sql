-- ============================================================================
-- Seed 200 loans with format LN-2025-XXXXX (starting at 20005).
-- Designed for longevity: data naturally ages through 7-day, 21-day, and
-- 60-day zones over the next 2 months so the dashboard always has activity.
--
-- Each loan has: borrower, MLO assignment, branch, risk score, timeline event.
-- Some loans get rate locks expiring at staggered future dates.
-- Safe to re-run: ON CONFLICT / IF NOT EXISTS guards.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  -- MLOs (reuse the 6 created in prior seed)
  lo1 UUID; lo2 UUID; lo3 UUID; lo4 UUID; lo5 UUID; lo6 UUID;
  officers UUID[];

  -- Branches
  br_midtown UUID; br_brooklyn UUID; br_astoria UUID;
  branch_ids UUID[];

  -- Loop vars
  i            INT;
  seq          INT;       -- 20005..20204
  officer      UUID;
  b_id         UUID;
  borrow_id    UUID;
  loan_uid     UUID;
  loan_num     TEXT;
  borrow_email TEXT;
  borrow_first TEXT;
  borrow_last  TEXT;
  loan_status  TEXT;
  loan_amt     DECIMAL(15,2);
  prop_addr    TEXT;
  prop_city    TEXT;
  prop_state   TEXT;
  prop_zip     TEXT;
  credit       INT;
  ltv_val      DECIMAL(5,2);
  dti_val      DECIMAL(5,2);
  risk_lvl     TEXT;
  risk_score   INT;
  days_stale   INT;
  created_ts   TIMESTAMPTZ;
  updated_ts   TIMESTAMPTZ;
  lock_exp     DATE;
  officer_idx  INT;

  first_names  TEXT[] := ARRAY[
    'Michael','Jennifer','Robert','Amanda','David','Jessica','Carlos','Samantha',
    'William','Emily','Daniel','Lauren','Anthony','Sophia','Thomas','Olivia',
    'Christopher','Megan','Andrew','Rachel','Joshua','Nicole','Matthew','Ashley',
    'Ryan','Stephanie','Brandon','Christina','Jason','Natalie'
  ];
  last_names   TEXT[] := ARRAY[
    'Johnson','Williams','Brown','Garcia','Martinez','Davis','Rodriguez','Chen',
    'Patel','Kim','Nguyen','Thompson','Anderson','Wilson','Taylor','Moore',
    'Jackson','White','Harris','Lewis','Clark','Walker','Hall','Young',
    'Allen','King','Wright','Scott','Green','Adams'
  ];
  streets      TEXT[] := ARRAY[
    'Park Avenue','Broadway','Atlantic Ave','Steinway St','Madison Ave',
    'Lexington Ave','Fifth Avenue','Court St','Main St','Flatbush Ave',
    'Queens Blvd','Grand Concourse','Northern Blvd','Astoria Blvd',
    'Metropolitan Ave','Myrtle Ave','DeKalb Ave','Fulton St','Canal St',
    'Delancey St'
  ];
  cities       TEXT[] := ARRAY['New York','Brooklyn','Queens','Bronx','Manhattan',
                                'Long Island City','Astoria','Flushing','Harlem','Tribeca'];
  zips         TEXT[] := ARRAY['10001','11201','11101','10451','10019',
                                '11109','11106','11354','10027','10013'];
  purposes     TEXT[] := ARRAY['purchase','refinance','cash_out_refinance','home_equity'];
  occupancies  TEXT[] := ARRAY['primary_residence','second_home','investment'];
BEGIN

  -- ================================================================
  -- 1. Resolve branches
  -- ================================================================
  SELECT id INTO br_midtown  FROM public.branches WHERE code = 'midtown_manhattan';
  SELECT id INTO br_brooklyn FROM public.branches WHERE code = 'brooklyn';
  SELECT id INTO br_astoria  FROM public.branches WHERE code = 'astoria';

  IF br_midtown IS NULL OR br_brooklyn IS NULL OR br_astoria IS NULL THEN
    INSERT INTO public.branches (name, code, is_active) VALUES
      ('Midtown Manhattan','midtown_manhattan',true),
      ('Brooklyn','brooklyn',true),
      ('Astoria','astoria',true)
    ON CONFLICT (code) DO NOTHING;
    SELECT id INTO br_midtown  FROM public.branches WHERE code = 'midtown_manhattan';
    SELECT id INTO br_brooklyn FROM public.branches WHERE code = 'brooklyn';
    SELECT id INTO br_astoria  FROM public.branches WHERE code = 'astoria';
  END IF;

  branch_ids := ARRAY[br_midtown, br_midtown, br_midtown, br_brooklyn, br_brooklyn, br_astoria];

  -- ================================================================
  -- 2. Resolve MLOs
  -- ================================================================
  SELECT id INTO lo1 FROM auth.users WHERE email = 'loanofficer@collabai.software';
  SELECT id INTO lo2 FROM auth.users WHERE email = 'sarah.mlo@collabai.software';
  SELECT id INTO lo3 FROM auth.users WHERE email = 'james.mlo@collabai.software';
  SELECT id INTO lo4 FROM auth.users WHERE email = 'maria.mlo@collabai.software';
  SELECT id INTO lo5 FROM auth.users WHERE email = 'kevin.mlo@collabai.software';
  SELECT id INTO lo6 FROM auth.users WHERE email = 'priya.mlo@collabai.software';

  -- Fallback: if some MLOs missing from prior seed, create them inline
  IF lo2 IS NULL THEN
    lo2 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo2,'00000000-0000-0000-0000-000000000000','sarah.mlo@collabai.software',extensions.crypt('SarahMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"Sarah Mitchell"}',now(),now(),'authenticated','authenticated',false);
    INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo2,'sarah.mlo@collabai.software','Sarah Mitchell',br_midtown) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id,role) VALUES (lo2,'user') ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF lo3 IS NULL THEN
    lo3 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo3,'00000000-0000-0000-0000-000000000000','james.mlo@collabai.software',extensions.crypt('JamesMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"James Cooper"}',now(),now(),'authenticated','authenticated',false);
    INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo3,'james.mlo@collabai.software','James Cooper',br_midtown) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id,role) VALUES (lo3,'user') ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF lo4 IS NULL THEN
    lo4 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo4,'00000000-0000-0000-0000-000000000000','maria.mlo@collabai.software',extensions.crypt('MariaMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"Maria Santos"}',now(),now(),'authenticated','authenticated',false);
    INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo4,'maria.mlo@collabai.software','Maria Santos',br_brooklyn) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id,role) VALUES (lo4,'user') ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF lo5 IS NULL THEN
    lo5 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo5,'00000000-0000-0000-0000-000000000000','kevin.mlo@collabai.software',extensions.crypt('KevinMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"Kevin Tran"}',now(),now(),'authenticated','authenticated',false);
    INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo5,'kevin.mlo@collabai.software','Kevin Tran',br_brooklyn) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id,role) VALUES (lo5,'user') ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF lo6 IS NULL THEN
    lo6 := gen_random_uuid();
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,role,aud,is_super_admin)
    VALUES (lo6,'00000000-0000-0000-0000-000000000000','priya.mlo@collabai.software',extensions.crypt('PriyaMLO@123',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"full_name":"Priya Desai"}',now(),now(),'authenticated','authenticated',false);
    INSERT INTO public.profiles (id,email,full_name,branch_id) VALUES (lo6,'priya.mlo@collabai.software','Priya Desai',br_astoria) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id,role) VALUES (lo6,'user') ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Use lo2 as fallback if lo1 (original LO) is missing
  IF lo1 IS NULL THEN lo1 := lo2; END IF;

  officers := ARRAY[lo1, lo2, lo3, lo4, lo5, lo6];

  -- ================================================================
  -- 3. Generate 200 loans: LN-2025-20005 through LN-2025-20204
  -- ================================================================
  --
  -- Staleness strategy for 2-month longevity:
  --   Band A (i 1-30):   updated_at = today          → fresh now, hits 7d in 1 week, 21d in 3 weeks
  --   Band B (i 31-55):  updated_at = 1-4 days ago   → hits 7d in 3-6 days, 21d in ~2.5 weeks
  --   Band C (i 56-80):  updated_at = 5-6 days ago   → hits 7d tomorrow-2 days
  --   Band D (i 81-110): updated_at = 8-15 days ago  → already in 7d zone, hits 21d in 6-13 days
  --   Band E (i 111-135): updated_at = 16-20 days ago → hits 21d in 1-5 days
  --   Band F (i 136-160): updated_at = 22-45 days ago → escalation zone now
  --   Band G (i 161-175): updated_at = 50-90 days ago → deeply stale
  --   Band H (i 176-200): terminal status (closed/denied/withdrawn), varied ages
  --
  FOR i IN 1..200 LOOP
    seq := 20004 + i;  -- 20005..20204
    loan_num := 'LN-2025-' || seq::TEXT;

    IF EXISTS (SELECT 1 FROM public.loans WHERE loan_number = loan_num) THEN
      CONTINUE;
    END IF;

    -- MLO assignment (round-robin across 6)
    officer_idx := ((i - 1) % 6) + 1;
    officer := officers[officer_idx];
    b_id    := branch_ids[officer_idx];

    -- ── Borrower ──────────────────────────────────────────────
    borrow_email := 'ln25.' || seq || '@example.com';
    borrow_first := first_names[1 + ((i - 1) % 30)];
    borrow_last  := last_names[1 + (((i - 1) * 7) % 30)];

    IF NOT EXISTS (SELECT 1 FROM public.borrowers WHERE email = borrow_email) THEN
      INSERT INTO public.borrowers (
        first_name, last_name, email, phone,
        street_address, city, state, postal_code,
        data_source, created_by
      ) VALUES (
        borrow_first, borrow_last, borrow_email,
        '212-' || LPAD((5000 + seq)::TEXT, 4, '0'),
        (100 + i * 5)::TEXT || ' ' || streets[1 + ((i - 1) % 20)],
        cities[1 + ((i - 1) % 10)],
        'NY',
        zips[1 + ((i - 1) % 10)],
        'manual', officer
      );
    END IF;
    SELECT id INTO borrow_id FROM public.borrowers WHERE email = borrow_email;
    IF borrow_id IS NULL THEN CONTINUE; END IF;

    -- ── Status distribution ───────────────────────────────────
    CASE
      WHEN i <= 15  THEN loan_status := 'draft';
      WHEN i <= 40  THEN loan_status := 'application';
      WHEN i <= 60  THEN loan_status := 'submitted';
      WHEN i <= 90  THEN loan_status := 'processing';
      WHEN i <= 115 THEN loan_status := 'underwriting';
      WHEN i <= 135 THEN loan_status := 'conditional_approval';
      WHEN i <= 150 THEN loan_status := 'clear_to_close';
      WHEN i <= 160 THEN loan_status := 'docs_out';
      WHEN i <= 175 THEN loan_status := 'funding';
      WHEN i <= 190 THEN loan_status := 'closed';
      WHEN i <= 196 THEN loan_status := 'denied';
      ELSE               loan_status := 'withdrawn';
    END CASE;

    -- Override terminal loans for band H
    IF i >= 176 AND i <= 190 THEN loan_status := 'closed';    END IF;
    IF i >= 191 AND i <= 196 THEN loan_status := 'denied';    END IF;
    IF i >= 197              THEN loan_status := 'withdrawn';  END IF;

    -- ── Financials ────────────────────────────────────────────
    loan_amt := 125000 + (seq * 4500) + ((i % 9) * 22000);
    credit   := 620 + ((seq * 13) % 200);
    ltv_val  := 55.00 + ((i * 3) % 43)::DECIMAL;
    dti_val  := 18.00 + ((i * 2) % 37)::DECIMAL;

    -- ── Property ──────────────────────────────────────────────
    prop_addr  := (100 + i * 5)::TEXT || ' ' || streets[1 + ((i - 1) % 20)];
    prop_city  := cities[1 + ((i - 1) % 10)];
    prop_state := 'NY';
    prop_zip   := zips[1 + ((i - 1) % 10)];

    -- ── Staleness bands ──────────────────────────────────────
    CASE
      WHEN i <= 30  THEN days_stale := 0;                              -- Band A: fresh today
      WHEN i <= 55  THEN days_stale := 1 + ((i - 31) % 4);            -- Band B: 1-4 days
      WHEN i <= 80  THEN days_stale := 5 + ((i - 56) % 2);            -- Band C: 5-6 days
      WHEN i <= 110 THEN days_stale := 8 + ((i - 81) % 8);            -- Band D: 8-15 days
      WHEN i <= 135 THEN days_stale := 16 + ((i - 111) % 5);          -- Band E: 16-20 days
      WHEN i <= 160 THEN days_stale := 22 + ((i - 136) % 24);         -- Band F: 22-45 days
      WHEN i <= 175 THEN days_stale := 50 + ((i - 161) % 41);         -- Band G: 50-90 days
      ELSE               days_stale := 5 + ((i - 176) % 60);          -- Band H: terminal, varied
    END CASE;

    created_ts := now() - ((days_stale + 20 + (i % 40))::TEXT || ' days')::INTERVAL;
    updated_ts := now() - (days_stale::TEXT || ' days')::INTERVAL;

    -- ── Lock expiration (staggered over next 2 months) ───────
    lock_exp := NULL;
    IF loan_status IN ('processing','underwriting','conditional_approval','clear_to_close','docs_out','funding') THEN
      CASE
        WHEN i % 5 = 0 THEN lock_exp := CURRENT_DATE + 3;     -- expiring in 3 days
        WHEN i % 7 = 0 THEN lock_exp := CURRENT_DATE + 6;     -- expiring in 6 days
        WHEN i % 9 = 0 THEN lock_exp := CURRENT_DATE + 14;    -- 2 weeks out
        WHEN i % 11 = 0 THEN lock_exp := CURRENT_DATE + 30;   -- 1 month out
        WHEN i % 13 = 0 THEN lock_exp := CURRENT_DATE + 45;   -- 6 weeks out
        WHEN i % 17 = 0 THEN lock_exp := CURRENT_DATE + 60;   -- 2 months out
        ELSE NULL;
      END CASE;
    END IF;

    -- ── Insert loan ──────────────────────────────────────────
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
      purposes[1 + ((i - 1) % 4)],
      occupancies[1 + ((i - 1) % 3)],
      prop_addr, prop_city, prop_state, prop_zip,
      lock_exp, b_id,
      created_ts, updated_ts, 'manual'
    );

    -- ── Risk score ───────────────────────────────────────────
    CASE
      WHEN i % 11 = 0 THEN risk_lvl := 'critical'; risk_score := 80 + (i % 20);
      WHEN i % 7  = 0 THEN risk_lvl := 'high';     risk_score := 60 + (i % 20);
      WHEN i % 3  = 0 THEN risk_lvl := 'medium';    risk_score := 35 + (i % 25);
      ELSE                  risk_lvl := 'low';       risk_score := 5 + (i % 30);
    END CASE;

    INSERT INTO public.loan_risk_scores (
      loan_id, overall_risk_score, risk_level, risk_factors,
      stall_risk, lock_expiry_risk, condition_risk, calculated_at
    ) VALUES (
      loan_uid, LEAST(risk_score, 100), risk_lvl,
      CASE risk_lvl
        WHEN 'critical' THEN '[{"factor":"High DTI ratio","weight":0.4},{"factor":"Stale file > 21 days","weight":0.35},{"factor":"Low credit score","weight":0.25}]'::jsonb
        WHEN 'high'     THEN '[{"factor":"Lock expiring soon","weight":0.5},{"factor":"Missing appraisal","weight":0.5}]'::jsonb
        WHEN 'medium'   THEN '[{"factor":"Incomplete documentation","weight":0.6},{"factor":"Employment gap","weight":0.4}]'::jsonb
        ELSE                  '[]'::jsonb
      END,
      CASE WHEN days_stale > 14 THEN LEAST(days_stale * 3, 100) ELSE LEAST(days_stale * 2, 100) END,
      CASE WHEN lock_exp IS NOT NULL AND lock_exp <= CURRENT_DATE + 7 THEN 75 ELSE 10 END,
      CASE WHEN risk_lvl IN ('high','critical') THEN LEAST(60 + (i % 30), 100) ELSE LEAST(10 + (i % 20), 100) END,
      updated_ts
    ) ON CONFLICT (loan_id) DO NOTHING;

    -- ── Rate lock row (if applicable) ────────────────────────
    IF lock_exp IS NOT NULL THEN
      INSERT INTO public.rate_locks (
        loan_id, branch_id, product_name, locked_rate,
        lock_date, lock_expiration, lock_term_days,
        locked_by_user_id, status
      ) VALUES (
        loan_uid, b_id,
        CASE (i % 4) WHEN 0 THEN '30yr Fixed' WHEN 1 THEN '15yr Fixed' WHEN 2 THEN '7/1 ARM' ELSE '5/1 ARM' END,
        5.250 + ((i % 20)::DECIMAL / 10),
        lock_exp - 30,
        lock_exp,
        CASE (i % 4) WHEN 0 THEN 30 WHEN 1 THEN 45 WHEN 2 THEN 60 ELSE 90 END,
        officer, 'active'
      );
    END IF;

    -- ── Timeline events (2-3 per loan for realism) ───────────
    INSERT INTO public.loan_timeline_events (
      loan_id, event_type, event_source, title, description, occurred_at, created_by
    ) VALUES (
      loan_uid, 'status_change', 'system',
      'Loan created as ' || loan_status,
      borrow_first || ' ' || borrow_last || ' — ' || loan_num || ' entered pipeline.',
      created_ts, officer
    );

    -- Second event: mid-life activity
    IF days_stale < 60 AND loan_status NOT IN ('draft','closed','denied','withdrawn') THEN
      INSERT INTO public.loan_timeline_events (
        loan_id, event_type, event_source, title, description, occurred_at, created_by
      ) VALUES (
        loan_uid, 'note', 'manual',
        CASE (i % 5)
          WHEN 0 THEN 'Document uploaded by borrower'
          WHEN 1 THEN 'Credit report pulled'
          WHEN 2 THEN 'Appraisal ordered'
          WHEN 3 THEN 'Conditions reviewed'
          ELSE 'Borrower contacted for update'
        END,
        'Activity on ' || loan_num || ' by ' || borrow_first || ' ' || borrow_last || '.',
        updated_ts + INTERVAL '2 hours', officer
      );
    END IF;

    -- Third event for older active loans
    IF days_stale > 10 AND loan_status NOT IN ('draft','closed','denied','withdrawn') THEN
      INSERT INTO public.loan_timeline_events (
        loan_id, event_type, event_source, title, description, occurred_at, created_by
      ) VALUES (
        loan_uid, 'alert', 'system',
        'Inactivity warning — ' || days_stale || ' days without update',
        loan_num || ' has not been updated in ' || days_stale || ' days.',
        now() - INTERVAL '1 day', NULL
      );
    END IF;

  END LOOP;

  RAISE NOTICE 'Seed complete: 200 loans (LN-2025-20005 to LN-2025-20204) with borrowers, risk scores, rate locks, and timeline events.';
END $$;
