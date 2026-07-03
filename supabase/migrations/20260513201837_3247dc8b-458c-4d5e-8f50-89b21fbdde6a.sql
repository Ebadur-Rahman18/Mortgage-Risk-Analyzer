ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS api_payload jsonb;

-- Backfill from legacy columns if present
UPDATE public.borrowers SET street_address = address_line1 WHERE street_address IS NULL AND address_line1 IS NOT NULL;
UPDATE public.borrowers SET postal_code = zip_code WHERE postal_code IS NULL AND zip_code IS NOT NULL;