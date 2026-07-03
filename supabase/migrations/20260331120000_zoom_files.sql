-- Zoom cloud recording file metadata (Server-to-Server sync). Service role writes; selective read via RLS.

CREATE TABLE IF NOT EXISTS public.zoom_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  zoom_meeting_uuid TEXT NOT NULL,
  zoom_recording_file_id TEXT NOT NULL,
  zoom_meeting_id TEXT,
  file_type TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN NOT NULL DEFAULT false,
  has_embeddings BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT zoom_files_zoom_file_unique UNIQUE (zoom_meeting_uuid, zoom_recording_file_id)
);

CREATE INDEX IF NOT EXISTS idx_zoom_files_meeting_id ON public.zoom_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_zoom_files_zoom_meeting_id ON public.zoom_files(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_zoom_files_created_at ON public.zoom_files(created_at);

COMMENT ON TABLE public.zoom_files IS 'Zoom cloud recording artifacts synced via sync-zoom-files edge function.';

DROP TRIGGER IF EXISTS zoom_files_updated_at ON public.zoom_files;
CREATE TRIGGER zoom_files_updated_at
  BEFORE UPDATE ON public.zoom_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.zoom_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zoom_files_select_linked ON public.zoom_files;
DROP POLICY IF EXISTS zoom_files_select_orphan_admin ON public.zoom_files;

-- Linked rows: any authenticated user who can read meetings can read (meetings are world-readable).
CREATE POLICY zoom_files_select_linked
  ON public.zoom_files FOR SELECT
  TO authenticated
  USING (
    meeting_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = zoom_files.meeting_id)
  );

-- Orphans (not yet matched to a meeting): admins only
CREATE POLICY zoom_files_select_orphan_admin
  ON public.zoom_files FOR SELECT
  TO authenticated
  USING (
    meeting_id IS NULL
    AND public.has_role('admin'::public.app_role, auth.uid())
  );

-- No INSERT/UPDATE/DELETE for authenticated clients — edge function uses service role.
