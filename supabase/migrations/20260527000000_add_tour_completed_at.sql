-- Add tour completion tracking to profiles.
-- NULL = user has not completed the tour → eligible for auto-start on first login.
-- Non-NULL = tour was completed or skipped; no auto-start.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completed_at timestamptz;

-- Mark all existing users as tour-complete so they are not shown the tour on next login.
-- Only brand-new signups (whose profile rows are created with tour_completed_at = NULL)
-- will receive the auto-tour experience.
UPDATE public.profiles
  SET tour_completed_at = now()
  WHERE tour_completed_at IS NULL;
