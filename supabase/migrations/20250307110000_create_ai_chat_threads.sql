-- AI Chat Threads: per-user, per-agent conversation history
-- Stores full message history as JSON for the latest chat threads.
-- Threads are user-scoped; admins can optionally read for troubleshooting.

CREATE TABLE IF NOT EXISTS public.ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_slug TEXT,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_chat_threads IS
  'Per-user AI chat threads, keyed by agent_slug. Stores full message history as JSON.';

CREATE INDEX IF NOT EXISTS idx_ai_chat_threads_user_id
  ON public.ai_chat_threads(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_chat_threads_agent_slug
  ON public.ai_chat_threads(agent_slug);

CREATE INDEX IF NOT EXISTS idx_ai_chat_threads_last_message
  ON public.ai_chat_threads(last_message_at DESC);

ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;

-- Users can see their own threads
CREATE POLICY "ai_chat_threads_select_own"
  ON public.ai_chat_threads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role('admin'::public.app_role, auth.uid()));

-- Users can insert their own threads
CREATE POLICY "ai_chat_threads_insert_own"
  ON public.ai_chat_threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own threads (e.g. append messages, rename)
CREATE POLICY "ai_chat_threads_update_own"
  ON public.ai_chat_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional: admins can delete any thread (cleanup)
CREATE POLICY "ai_chat_threads_admin_delete"
  ON public.ai_chat_threads FOR DELETE
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()));

CREATE TRIGGER ai_chat_threads_updated_at
  BEFORE UPDATE ON public.ai_chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

