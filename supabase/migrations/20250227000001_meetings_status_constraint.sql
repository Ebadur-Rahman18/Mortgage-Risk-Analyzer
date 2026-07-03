-- Harden the meetings.status column:
--   1. Backfill any NULL status rows so we can make it NOT NULL.
--   2. Set the column DEFAULT to 'scheduled'.
--   3. Make the column NOT NULL.
--   4. Add a CHECK constraint so only valid values are ever stored.

-- Step 1: Backfill NULLs
UPDATE public.meetings
SET status = 'scheduled'
WHERE status IS NULL;

-- Step 2 + 3: Default + NOT NULL
ALTER TABLE public.meetings
  ALTER COLUMN status SET DEFAULT 'scheduled',
  ALTER COLUMN status SET NOT NULL;

-- Step 4: CHECK constraint (idempotent)
ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled'));
