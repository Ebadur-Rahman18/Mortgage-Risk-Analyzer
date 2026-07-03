CREATE TABLE IF NOT EXISTS public.user_agent_customizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  system_prompt_override text,
  knowledge_entry_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_id)
);

ALTER TABLE public.user_agent_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_agent_cust_own_select"
  ON public.user_agent_customizations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_agent_cust_own_insert"
  ON public.user_agent_customizations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_agent_cust_own_update"
  ON public.user_agent_customizations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_agent_cust_own_delete"
  ON public.user_agent_customizations FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER user_agent_cust_set_updated_at
  BEFORE UPDATE ON public.user_agent_customizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS user_agent_cust_user_idx ON public.user_agent_customizations(user_id);
CREATE INDEX IF NOT EXISTS user_agent_cust_agent_idx ON public.user_agent_customizations(agent_id);