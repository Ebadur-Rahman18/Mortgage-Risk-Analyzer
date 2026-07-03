-- Align condition status values to match the canonical set:
-- pending | received | waived | expired | cleared
-- Previously the UI was writing 'approved' and 'rejected'; normalize these.

UPDATE public.loan_conditions SET status = 'cleared'  WHERE status = 'approved';
UPDATE public.loan_conditions SET status = 'expired'  WHERE status = 'rejected';

ALTER TABLE public.loan_conditions
  DROP CONSTRAINT IF EXISTS loan_conditions_status_check;
ALTER TABLE public.loan_conditions
  ADD CONSTRAINT loan_conditions_status_check
  CHECK (status IN ('pending', 'received', 'waived', 'expired', 'cleared'));
