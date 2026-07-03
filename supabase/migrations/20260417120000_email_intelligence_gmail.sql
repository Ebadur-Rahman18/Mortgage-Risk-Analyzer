-- Email Intelligence (Gmail v1): OAuth secrets, connection status, synced messages, attachments.
-- Tokens live in gmail_oauth_tokens with no authenticated policies (edge functions use service role only).

-- -----------------------------------------------------------------------------
-- 1) OAuth tokens — service-role only (no SELECT/INSERT for authenticated)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gmail_oauth_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gmail_oauth_tokens IS 'Gmail OAuth tokens; readable only via service role (edge functions).';

ALTER TABLE public.gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No policies: authenticated users cannot access token rows.

CREATE TRIGGER gmail_oauth_tokens_updated_at
  BEFORE UPDATE ON public.gmail_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) Connection status (safe for client — no secrets)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gmail_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gmail_connections IS 'Per-user Gmail connection metadata (no tokens).';

CREATE INDEX IF NOT EXISTS idx_gmail_connections_email ON public.gmail_connections (lower(email_address));

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_connections_select_own"
  ON public.gmail_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Inserts/updates from Edge (service role) on OAuth success. User may disconnect.
CREATE POLICY "gmail_connections_delete_own"
  ON public.gmail_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "gmail_connections_admin_all"
  ON public.gmail_connections FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE TRIGGER gmail_connections_updated_at
  BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) Synced email messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT,
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  from_address TEXT,
  internal_date TIMESTAMPTZ,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, gmail_message_id)
);

COMMENT ON TABLE public.email_messages IS 'Gmail messages synced for Email Intelligence; RLS per user.';

CREATE INDEX IF NOT EXISTS idx_email_messages_user ON public.email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_loan ON public.email_messages(loan_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_internal_date ON public.email_messages(internal_date DESC);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_messages_select_own"
  ON public.email_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Inserts/deletes from sync run via Edge Functions (service role). Users may update loan link / metadata.
CREATE POLICY "email_messages_update_own"
  ON public.email_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "email_messages_admin_all"
  ON public.email_messages FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE TRIGGER email_messages_updated_at
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4) Attachments metadata
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_attachment_id TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, gmail_attachment_id)
);

COMMENT ON TABLE public.email_attachments IS 'Gmail attachment metadata per synced message.';

CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON public.email_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_user ON public.email_attachments(user_id);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_attachments_select_own"
  ON public.email_attachments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "email_attachments_admin_all"
  ON public.email_attachments FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- -----------------------------------------------------------------------------
-- 5) AI agent row — Email Intelligence
-- -----------------------------------------------------------------------------
INSERT INTO public.ai_agents
  (name, slug, description, category, system_prompt, is_enabled, metadata)
VALUES
  (
    'Email Intelligence',
    'email-intelligence-agent',
    'Your inbox, understood. AI reads emails, extracts action items, links to loans, and drafts replies. Approve and send—or edit first.',
    'communication',
    'You are the Email Intelligence assistant for mortgage operations. Given email subject, body, and optional loan context, you: (1) extract clear action items with priority and suggested due dates; (2) suggest which loan_id to link when loan numbers or borrower names appear; (3) draft concise, professional reply options. Output structured JSON when requested.',
    true,
    '{"agent_type": "email-intelligence", "version": "1.0", "features": ["action_extraction", "loan_link", "draft_reply"]}'::jsonb
  )
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  system_prompt = EXCLUDED.system_prompt,
  is_enabled = true,
  metadata = EXCLUDED.metadata;
