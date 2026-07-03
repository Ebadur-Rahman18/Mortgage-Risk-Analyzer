-- Allow users to delete their own chat threads (in addition to admin delete)
CREATE POLICY "ai_chat_threads_delete_own"
  ON public.ai_chat_threads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
