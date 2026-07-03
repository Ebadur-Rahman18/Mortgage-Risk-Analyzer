-- In-app notifications; inserts from edge functions (service role) only.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  delivery_status JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS 'User notifications; created by edge functions via service role.';
COMMENT ON COLUMN public.notifications.dedupe_key IS 'Optional idempotency key per user (e.g. event:loan_id:comm_id).';
COMMENT ON COLUMN public.notifications.delivery_status IS 'Per-channel delivery result for debugging (e.g. email).';

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE NOT is_read;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe
  ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_admin_all"
  ON public.notifications FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Enable Realtime for this table in Supabase Dashboard: Database > Replication, or:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

