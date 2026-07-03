ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tour_completed_at timestamptz;
UPDATE public.profiles SET tour_completed_at = now() WHERE tour_completed_at IS NULL;