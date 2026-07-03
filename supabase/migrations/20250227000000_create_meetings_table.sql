-- Meetings Module – Core CRUD
-- Fully idempotent: safe to run whether the meetings table exists already or not.
-- All authenticated users can view meetings.
-- Only admins (role = 'admin') can create, update, or delete meetings.

-- =============================================================================
-- 1. Create table (skipped if it already exists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  description     TEXT,
  scheduled_at    TIMESTAMPTZ,
  duration_minutes INTEGER,
  status          TEXT        NOT NULL DEFAULT 'scheduled',
  location        TEXT,
  meeting_type    TEXT        NOT NULL DEFAULT 'manual',
  client_id       UUID,
  organizer_id    UUID,
  zoom_meeting_id TEXT,
  zoom_join_url   TEXT,
  zoom_start_url  TEXT,
  zoom_uuid       TEXT,
  zoom_id         TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. Add any columns the pre-existing table might be missing
--    (ALTER TABLE ADD COLUMN IF NOT EXISTS is safe to run on a fresh table too)
-- =============================================================================
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS scheduled_at    TIMESTAMPTZ;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS location        TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS meeting_type    TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS client_id       UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS organizer_id    UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS zoom_join_url   TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS zoom_start_url  TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS zoom_uuid       TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS zoom_id         TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS metadata        JSONB;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- =============================================================================
-- 3. Foreign key constraints (added only if they don't exist yet)
-- =============================================================================
DO $$
BEGIN
  -- client_id -> clients.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_client_id_fkey'
      AND table_name = 'meetings' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- organizer_id -> auth.users.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_organizer_id_fkey'
      AND table_name = 'meetings' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_organizer_id_fkey
      FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- =============================================================================
-- 4. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_meetings_organizer_id  ON public.meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id     ON public.meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at  ON public.meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status        ON public.meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at    ON public.meetings(created_at);

-- =============================================================================
-- 5. updated_at trigger
-- =============================================================================
DROP TRIGGER IF EXISTS meetings_updated_at ON public.meetings;
CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 6. Row Level Security
-- =============================================================================
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first so re-runs don't error
DROP POLICY IF EXISTS "meetings_select_authenticated" ON public.meetings;
DROP POLICY IF EXISTS "meetings_admin_insert"         ON public.meetings;
DROP POLICY IF EXISTS "meetings_admin_update"         ON public.meetings;
DROP POLICY IF EXISTS "meetings_admin_delete"         ON public.meetings;

-- All authenticated users can read meetings
CREATE POLICY "meetings_select_authenticated"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert meetings
CREATE POLICY "meetings_admin_insert"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Only admins can update meetings
CREATE POLICY "meetings_admin_update"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING  (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Only admins can delete meetings
CREATE POLICY "meetings_admin_delete"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()));

-- =============================================================================
-- 7. Foreign key: tasks.meeting_id -> meetings.id
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_meeting_id_fkey'
      AND table_name = 'tasks' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_meeting_id_fkey
      FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;
  END IF;
END;
$$;
