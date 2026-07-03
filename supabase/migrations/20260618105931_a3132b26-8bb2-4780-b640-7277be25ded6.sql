DROP POLICY IF EXISTS users_own_personalizations ON public.user_agent_personalizations;

CREATE POLICY users_own_personalizations
ON public.user_agent_personalizations
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);