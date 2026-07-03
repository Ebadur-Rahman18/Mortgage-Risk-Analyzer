CREATE POLICY "loans_moderator_read" ON public.loans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'::public.app_role));