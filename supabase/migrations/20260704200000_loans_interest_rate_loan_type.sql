-- Add loan_type and interest_rate to loans (Risk Copilot + loan form).
-- These columns were defined in a later CREATE TABLE IF NOT EXISTS migration but never
-- applied because public.loans already existed from the original schema.

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS loan_type TEXT;

COMMENT ON COLUMN public.loans.interest_rate IS 'Note rate as percent (e.g. 6.5 for 6.5%).';
COMMENT ON COLUMN public.loans.loan_type IS 'Product type label (e.g. Conventional, FHA, VA).';
