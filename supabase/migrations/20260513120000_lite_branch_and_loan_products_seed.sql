-- MCT Lite: minimal org data so loan officers can create loans and select products.
-- Idempotent: safe to re-run.

-- 1. At least one active branch
INSERT INTO public.branches (name, code, is_active)
SELECT 'Main Branch', 'MAIN', true
WHERE NOT EXISTS (SELECT 1 FROM public.branches WHERE is_active = true LIMIT 1);

-- 2. Assign branch to profiles that have none (common for freshly provisioned LO accounts)
UPDATE public.profiles p
SET branch_id = (
  SELECT b.id
  FROM public.branches b
  WHERE b.is_active = true
  ORDER BY b.created_at
  LIMIT 1
)
WHERE p.branch_id IS NULL
  AND EXISTS (SELECT 1 FROM public.branches b WHERE b.is_active = true LIMIT 1);

-- 3. At least one active loan product (LoanForm product dropdown)
INSERT INTO public.loan_products (product_name, product_type, term_months, rate_type, is_active)
SELECT 'Conventional 30-Year Fixed', 'Conventional', 360, 'Fixed', true
WHERE NOT EXISTS (SELECT 1 FROM public.loan_products WHERE is_active = true LIMIT 1);

-- 4. One program for that product when missing
DO $$
DECLARE
  pid uuid;
BEGIN
  SELECT lp.id INTO pid
  FROM public.loan_products lp
  WHERE lp.is_active = true
  ORDER BY lp.created_at
  LIMIT 1;

  IF pid IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.loan_programs lpr WHERE lpr.product_id = pid AND lpr.is_active = true LIMIT 1) THEN
    INSERT INTO public.loan_programs (product_id, program_code, program_name, is_active)
    VALUES (pid, 'CONV30', 'Conventional 30-Year Fixed', true);
  END IF;
END $$;
