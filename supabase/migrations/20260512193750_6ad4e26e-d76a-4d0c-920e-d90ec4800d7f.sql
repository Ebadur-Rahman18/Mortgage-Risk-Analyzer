-- MCT Lite: guarded seed for branches/loan_products/loan_programs.
-- Tables may not exist in the Lite schema — to_regclass guards make this a no-op when absent.

DO $$
BEGIN
  IF to_regclass('public.branches') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.branches (name, code, is_active)
      SELECT 'Main Branch', 'MAIN', true
      WHERE NOT EXISTS (SELECT 1 FROM public.branches WHERE is_active = true)
    $sql$;

    EXECUTE $sql$
      UPDATE public.profiles p
      SET branch_id = (
        SELECT b.id FROM public.branches b WHERE b.is_active = true ORDER BY b.created_at LIMIT 1
      )
      WHERE p.branch_id IS NULL
        AND EXISTS (SELECT 1 FROM public.branches b WHERE b.is_active = true)
    $sql$;
  END IF;

  IF to_regclass('public.loan_products') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.loan_products (product_name, product_type, term_months, rate_type, is_active)
      SELECT 'Conventional 30-Year Fixed', 'Conventional', 360, 'Fixed', true
      WHERE NOT EXISTS (SELECT 1 FROM public.loan_products WHERE is_active = true)
    $sql$;
  END IF;

  IF to_regclass('public.loan_products') IS NOT NULL AND to_regclass('public.loan_programs') IS NOT NULL THEN
    DECLARE pid uuid;
    BEGIN
      SELECT lp.id INTO pid FROM public.loan_products lp WHERE lp.is_active = true ORDER BY lp.created_at LIMIT 1;
      IF pid IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.loan_programs lpr WHERE lpr.product_id = pid AND lpr.is_active = true
      ) THEN
        INSERT INTO public.loan_programs (product_id, program_code, program_name, is_active)
        VALUES (pid, 'CONV30', 'Conventional 30-Year Fixed', true);
      END IF;
    END;
  END IF;
END $$;