
-- 1. agent_memories: add DELETE policy
CREATE POLICY "Users delete own memories"
ON public.agent_memories
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 2. document_extracts: add owner write policies
CREATE POLICY "document_extracts_insert_own"
ON public.document_extracts
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "document_extracts_update_own"
ON public.document_extracts
FOR UPDATE
TO authenticated
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "document_extracts_delete_own"
ON public.document_extracts
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 3. roles: restrict SELECT so users only see their own assigned role
DROP POLICY IF EXISTS roles_read ON public.roles;

CREATE POLICY "roles_read_admin_all"
ON public.roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "roles_read_own_assigned"
ON public.roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.custom_role_id = roles.id
  )
);

-- 4. Fix tg_set_updated_at search_path
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 5. Revoke EXECUTE on SECURITY DEFINER functions from anon (and PUBLIC)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_relevant_memories(uuid, uuid, vector, double precision, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consolidate_short_term_memories(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prune_short_term_memories(uuid, uuid, integer, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_memory_access(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_conversation_title() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_conversation_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
