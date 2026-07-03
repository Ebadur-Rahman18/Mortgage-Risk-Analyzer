-- User permission settings: per-user enable/disable of module permissions.
-- Used when editing a user in User Management; settings stored per user_id.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.user_permission_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_permission_settings IS 'Per-user permission toggles (e.g. enable/disable modules). Array of permission keys like "users:read".';

CREATE INDEX IF NOT EXISTS idx_user_permission_settings_updated_at
  ON public.user_permission_settings(updated_at);

-- RLS: users can read their own row; only admins can insert/update/delete (via has_role)
ALTER TABLE public.user_permission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_permission_settings_select_own"
  ON public.user_permission_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_permission_settings_admin_all"
  ON public.user_permission_settings FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Keep updated_at in sync
CREATE TRIGGER user_permission_settings_updated_at
  BEFORE UPDATE ON public.user_permission_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
