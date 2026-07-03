-- Demo pipeline for loanofficer@collabai.software: 5 loans, borrowers, tasks, timeline events.
-- Uses data_source = 'demo' so the app can hide these when LendingPad/HubSpot/Encompass is active.

DO $$
DECLARE
  lo_id       UUID;
  b_id        UUID;
  loan_id     UUID;
  i           INT;
  loan_nums   TEXT[] := ARRAY['LN-DEMO-001','LN-DEMO-002','LN-DEMO-003','LN-DEMO-004','LN-DEMO-005'];
  statuses    TEXT[] := ARRAY['application','processing','underwriting','conditional_approval','clear_to_close'];
  first_names TEXT[] := ARRAY['Alex','Jordan','Taylor','Morgan','Casey'];
  last_names  TEXT[] := ARRAY['Rivera','Chen','Brooks','Patel','Nguyen'];
  amounts     NUMERIC[] := ARRAY[325000, 412500, 289000, 550000, 198750];
BEGIN
  SELECT id INTO lo_id FROM auth.users WHERE email = 'loanofficer@collabai.software';
  IF lo_id IS NULL THEN
    RAISE NOTICE 'seed_demo_loan_officer: loanofficer@collabai.software not found — skipping';
    RETURN;
  END IF;

  FOR i IN 1..5 LOOP
    IF EXISTS (SELECT 1 FROM public.loans WHERE loan_number = loan_nums[i]) THEN
      CONTINUE;
    END IF;

    b_id := gen_random_uuid();
    INSERT INTO public.borrowers (
      id, first_name, last_name, email, phone, city, state, postal_code,
      data_source, created_by
    ) VALUES (
      b_id,
      first_names[i], last_names[i],
      lower(first_names[i]) || '.demo' || i || '@example.com',
      '555-010' || i::text,
      'Austin', 'TX', '78701',
      'demo', lo_id
    );

    loan_id := gen_random_uuid();
    INSERT INTO public.loans (
      id, loan_number, borrower_id, loan_officer_id, status,
      loan_amount, credit_score, ltv, dti,
      purpose, occupancy_type,
      property_address, property_city, property_state, property_postal_code,
      lock_expiration_date, data_source, created_by,
      created_at, updated_at
    ) VALUES (
      loan_id, loan_nums[i], b_id, lo_id, statuses[i],
      amounts[i], 680 + (i * 12), 78.5 + i, 38.0 + (i * 0.5),
      CASE WHEN i % 2 = 0 THEN 'Purchase' ELSE 'Refinance' END,
      'Primary',
      (100 + i)::text || ' Demo Lane', 'Austin', 'TX', '7870' || i::text,
      CURRENT_DATE + (7 + i),
      'demo', lo_id,
      now() - (i || ' days')::interval,
      now() - (i || ' hours')::interval
    );

    INSERT INTO public.loan_timeline_events (loan_id, event_type, event_source, title, description, metadata)
    VALUES
      (loan_id, 'status_change', 'system', 'Application received', 'Demo loan created for pipeline preview.', '{"demo":true}'::jsonb),
      (loan_id, 'note', 'user', 'Initial outreach', 'Borrower contacted — demo timeline event.', '{"demo":true}'::jsonb);

    INSERT INTO public.tasks (title, description, status, priority, assigned_to, created_by, loan_id, due_date, is_demo)
    VALUES (
      'Follow up: ' || loan_nums[i],
      'Demo task — verify income docs for ' || first_names[i] || ' ' || last_names[i] || '.',
      CASE WHEN i <= 2 THEN 'open' WHEN i = 3 THEN 'in_progress' ELSE 'open' END,
      CASE WHEN i = 5 THEN 'high' ELSE 'medium' END,
      lo_id, lo_id, loan_id,
      (now() + (i || ' days')::interval)::timestamptz,
      true
    );
  END LOOP;

  -- One extra LO task not tied to a specific loan
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks WHERE assigned_to = lo_id AND is_demo = true AND title = 'Review rate lock expirations (demo)'
  ) THEN
    INSERT INTO public.tasks (title, description, status, priority, assigned_to, created_by, due_date, is_demo)
    VALUES (
      'Review rate lock expirations (demo)',
      'Sample pipeline task — locks expiring within 7 days.',
      'open', 'high', lo_id, lo_id, (now() + interval '1 day')::timestamptz, true
    );
  END IF;
END;
$$;
