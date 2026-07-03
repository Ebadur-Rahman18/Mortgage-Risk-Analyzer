-- Add unique constraint on loan_id so the edge function can upsert
-- (one risk score row per loan, overwritten on each recalculation).
ALTER TABLE public.loan_risk_scores
  DROP CONSTRAINT IF EXISTS loan_risk_scores_loan_id_unique;
ALTER TABLE public.loan_risk_scores
  ADD CONSTRAINT loan_risk_scores_loan_id_unique UNIQUE (loan_id);
