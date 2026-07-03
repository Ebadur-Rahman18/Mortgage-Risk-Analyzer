-- Fix action_items delete policy so that
-- creators, assignees, and delegators can delete tasks.

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_items_delete_creator ON public.action_items;

CREATE POLICY action_items_delete_creator
  ON public.action_items FOR DELETE
  TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR assigned_to_user_id = auth.uid()
    OR assigned_by_user_id = auth.uid()
  );

