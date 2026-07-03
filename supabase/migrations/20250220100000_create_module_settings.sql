-- Module settings: admin can enable/disable modules (e.g. Loans).
-- When disabled, that module's UI and data are hidden from all users.

CREATE TABLE IF NOT EXISTS public.module_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.module_settings IS 'Per-module enable/disable toggles (e.g. Loans). When disabled, module UI and routes are hidden.';

CREATE INDEX IF NOT EXISTS idx_module_settings_slug ON public.module_settings(slug);
CREATE INDEX IF NOT EXISTS idx_module_settings_enabled ON public.module_settings(enabled);

-- RLS: everyone can read (to know if module is enabled); only admins can update
ALTER TABLE public.module_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_settings_select_all"
  ON public.module_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "module_settings_admin_update"
  ON public.module_settings FOR UPDATE
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER module_settings_updated_at
  BEFORE UPDATE ON public.module_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: Loans module (others can be added later)
INSERT INTO public.module_settings (slug, name, description, enabled, display_order)
VALUES
  ('loans', 'Loans Module', 'Loan applications, borrowers, and loan pipeline. Supports manual entry and third-party sync (e.g. GSE, credit bureau).', false, 10)
ON CONFLICT (slug) DO NOTHING;
