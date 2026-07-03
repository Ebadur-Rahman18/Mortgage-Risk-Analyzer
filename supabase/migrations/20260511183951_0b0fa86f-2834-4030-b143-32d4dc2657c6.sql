
CREATE TABLE IF NOT EXISTS public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  api_key TEXT,
  api_key_masked TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  validation_status TEXT,
  validation_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS integration_settings_provider_name_idx
  ON public.integration_settings (provider_name);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_settings_admin_all ON public.integration_settings;
CREATE POLICY integration_settings_admin_all
  ON public.integration_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS set_integration_settings_updated_at ON public.integration_settings;
CREATE TRIGGER set_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.integration_settings (provider_name, display_name, is_active, validation_status)
VALUES
  ('openai', 'OpenAI', false, 'not_tested'),
  ('anthropic', 'Anthropic', false, 'not_tested'),
  ('google', 'Google AI', false, 'not_tested'),
  ('encompass', 'Encompass', false, 'not_tested'),
  ('lendingpad', 'LendingPad', false, 'not_tested'),
  ('hubspot', 'HubSpot', false, 'not_tested'),
  ('zoom', 'Zoom', false, 'not_tested'),
  ('sendgrid', 'SendGrid', false, 'not_tested'),
  ('freddie-mac', 'Freddie Mac', false, 'not_tested'),
  ('credit-bureau', 'Credit Bureau', false, 'not_tested')
ON CONFLICT (provider_name) DO NOTHING;
