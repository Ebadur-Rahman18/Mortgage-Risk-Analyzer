
-- Tighten agent_conversations and agent_messages policies to authenticated role only
DROP POLICY IF EXISTS users_own_conversations ON public.agent_conversations;
CREATE POLICY users_own_conversations ON public.agent_conversations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS users_own_messages ON public.agent_messages;
CREATE POLICY users_own_messages ON public.agent_messages
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agent_conversations c WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agent_conversations c WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid()));

-- Allow loan officers to read borrowers attached to loans they own or are assigned to
DROP POLICY IF EXISTS borrowers_lo_assigned_loan ON public.borrowers;
CREATE POLICY borrowers_lo_assigned_loan ON public.borrowers
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.borrower_id = borrowers.id
        AND (l.loan_officer_id = auth.uid() OR l.created_by = auth.uid())
    )
  );
