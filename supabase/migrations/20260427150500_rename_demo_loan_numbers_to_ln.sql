-- Rename demo-prefixed loan numbers to LN-prefixed loan numbers.
-- Example: DEMO-2026-0090 -> LN-2026-0090
-- Skip rows where the LN target already exists to preserve uniqueness.
WITH candidates AS (
  SELECT
    l.id,
    l.loan_number,
    regexp_replace(l.loan_number, '^DEMO-', 'LN-') AS new_loan_number
  FROM public.loans l
  WHERE l.loan_number LIKE 'DEMO-%'
),
deduped AS (
  SELECT c.id, c.new_loan_number
  FROM candidates c
  LEFT JOIN public.loans existing
    ON existing.loan_number = c.new_loan_number
   AND existing.id <> c.id
  WHERE existing.id IS NULL
)
UPDATE public.loans l
SET loan_number = d.new_loan_number
FROM deduped d
WHERE l.id = d.id;
