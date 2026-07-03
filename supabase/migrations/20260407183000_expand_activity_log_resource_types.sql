-- Expand allowed resource types so activity logs can track mortgage workflows.
ALTER TABLE public.activity_logs
DROP CONSTRAINT IF EXISTS activity_logs_resource_type_check;

ALTER TABLE public.activity_logs
ADD CONSTRAINT activity_logs_resource_type_check
CHECK (
  resource_type IS NULL OR resource_type IN (
    'client',
    'meeting',
    'task',
    'knowledge',
    'user',
    'role',
    'feedback',
    'ai_chat',
    'settings',
    'loan',
    'rate_lock',
    'document',
    'rate_sheet',
    'action_item',
    'pipeline',
    'agent'
  )
);

-- Central trigger logger for table mutations.
CREATE OR REPLACE FUNCTION public.log_activity_from_table_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
  action_name text;
  actor_id uuid;
  resource_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
    action_name := 'delete';
  ELSIF TG_OP = 'UPDATE' THEN
    row_data := to_jsonb(NEW);
    action_name := 'update';
  ELSE
    row_data := to_jsonb(NEW);
    action_name := 'create';
  END IF;

  -- Prefer JWT user, then common ownership columns used in this schema.
  actor_id := COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    NULLIF(row_data->>'created_by', '')::uuid,
    NULLIF(row_data->>'created_by_user_id', '')::uuid,
    NULLIF(row_data->>'uploaded_by', '')::uuid,
    NULLIF(row_data->>'author_id', '')::uuid,
    NULLIF(row_data->>'loan_officer_id', '')::uuid,
    NULLIF(row_data->>'user_id', '')::uuid
  );

  -- activity_logs.user_id is required; if no actor can be derived, skip.
  IF actor_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  resource_id := COALESCE(row_data->>'id', row_data->>'loan_id');

  INSERT INTO public.activity_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  )
  VALUES (
    actor_id,
    action_name,
    COALESCE(TG_ARGV[0], TG_TABLE_NAME),
    resource_id,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    ),
    NULL,
    NULL
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.loans') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_loans ON public.loans;
    CREATE TRIGGER trg_activity_logs_loans
    AFTER INSERT OR UPDATE OR DELETE ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('loan');
  END IF;

  IF to_regclass('public.rate_locks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_rate_locks ON public.rate_locks;
    CREATE TRIGGER trg_activity_logs_rate_locks
    AFTER INSERT OR UPDATE OR DELETE ON public.rate_locks
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('rate_lock');
  END IF;

  IF to_regclass('public.loan_documents') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_loan_documents ON public.loan_documents;
    CREATE TRIGGER trg_activity_logs_loan_documents
    AFTER INSERT OR UPDATE OR DELETE ON public.loan_documents
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('document');
  END IF;

  IF to_regclass('public.ai_agents') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_ai_agents ON public.ai_agents;
    CREATE TRIGGER trg_activity_logs_ai_agents
    AFTER INSERT OR UPDATE OR DELETE ON public.ai_agents
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('agent');
  END IF;

  IF to_regclass('public.action_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_action_items ON public.action_items;
    CREATE TRIGGER trg_activity_logs_action_items
    AFTER INSERT OR UPDATE OR DELETE ON public.action_items
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('action_item');
  END IF;

  IF to_regclass('public.knowledge_entries') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_knowledge_entries ON public.knowledge_entries;
    CREATE TRIGGER trg_activity_logs_knowledge_entries
    AFTER INSERT OR UPDATE OR DELETE ON public.knowledge_entries
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('knowledge');
  END IF;

  IF to_regclass('public.knowledge_categories') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_knowledge_categories ON public.knowledge_categories;
    CREATE TRIGGER trg_activity_logs_knowledge_categories
    AFTER INSERT OR UPDATE OR DELETE ON public.knowledge_categories
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('knowledge');
  END IF;

  IF to_regclass('public.pipeline_priority_scores') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_pipeline_priority_scores ON public.pipeline_priority_scores;
    CREATE TRIGGER trg_activity_logs_pipeline_priority_scores
    AFTER INSERT OR UPDATE OR DELETE ON public.pipeline_priority_scores
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('pipeline');
  END IF;

  IF to_regclass('public.borrower_communications') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_activity_logs_borrower_communications ON public.borrower_communications;
    CREATE TRIGGER trg_activity_logs_borrower_communications
    AFTER INSERT OR UPDATE OR DELETE ON public.borrower_communications
    FOR EACH ROW EXECUTE FUNCTION public.log_activity_from_table_change('document');
  END IF;
END $$;
