-- Align public.borrowers with app hooks (useBorrowers) and BorrowerForm.
-- Scaffold databases (address_line1 / zip_code only) get LOS-style columns + sync fields.
-- Databases that already have these columns from earlier migrations are unchanged.

ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS api_payload JSONB,
  ADD COLUMN IF NOT EXISTS street_address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

COMMENT ON COLUMN public.borrowers.data_source IS 'manual | lendingpad | encompass | csv_import | etc.';
COMMENT ON COLUMN public.borrowers.external_id IS 'ID from external system for sync deduplication.';
COMMENT ON COLUMN public.borrowers.api_payload IS 'Raw or normalized payload from API for audit/future mapping.';

-- Backfill from legacy scaffold columns when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'borrowers' AND column_name = 'address_line1'
  ) THEN
    UPDATE public.borrowers
    SET street_address = address_line1
    WHERE coalesce(trim(street_address), '') = ''
      AND coalesce(trim(address_line1), '') <> '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'borrowers' AND column_name = 'zip_code'
  ) THEN
    UPDATE public.borrowers
    SET postal_code = zip_code
    WHERE coalesce(trim(postal_code), '') = ''
      AND coalesce(trim(zip_code), '') <> '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_borrowers_external_id ON public.borrowers(external_id);
