-- Enhance Action Items into lightweight task management:
-- - start_date, created_by, watchers, richer status workflow
-- - task_comments table with RLS (assigned/creator/watchers/admin/moderator)
--
-- NOTE: We keep existing columns (assigned_to_user_id, assigned_by_user_id, due_date, description)
-- and migrate old status values to the new set.

-- =============================================================================
-- 1) Columns + defaults
-- =============================================================================
ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS watchers UUID[] NOT NULL DEFAULT '{}'::uuid[];

-- Default created_by_user_id to the inserting user for new rows.
ALTER TABLE public.action_items
  ALTER COLUMN created_by_user_id SET DEFAULT auth.uid();

-- Backfill created_by_user_id for existing rows.
UPDATE public.action_items
SET created_by_user_id = COALESCE(created_by_user_id, assigned_by_user_id, assigned_to_user_id)
WHERE created_by_user_id IS NULL;

-- =============================================================================
-- 2) Status workflow
--    Target set:
--      not_started | in_progress | blocked | completed | on_hold | cancelled
-- =============================================================================

-- Map old statuses to new ones.
UPDATE public.action_items
SET status = CASE status
  WHEN 'pending' THEN 'not_started'
  WHEN 'in_progress' THEN 'in_progress'
  WHEN 'completed' THEN 'completed'
  WHEN 'cancelled' THEN 'cancelled'
  ELSE 'not_started'
END
WHERE status IS NOT NULL;

-- Enforce allowed statuses.
ALTER TABLE public.action_items
  DROP CONSTRAINT IF EXISTS action_items_status_check;

ALTER TABLE public.action_items
  ADD CONSTRAINT action_items_status_check
  CHECK (status IN ('not_started','in_progress','blocked','completed','on_hold','cancelled'));

-- =============================================================================
-- 3) Date logic: start_date <= due_date (when both present)
-- =============================================================================
ALTER TABLE public.action_items
  DROP CONSTRAINT IF EXISTS action_items_start_due_check;

ALTER TABLE public.action_items
  ADD CONSTRAINT action_items_start_due_check
  CHECK (
    start_date IS NULL
    OR due_date IS NULL
    OR start_date <= due_date
  );

-- =============================================================================
-- 4) Watchers invariants (softly enforced in app; DB keeps array)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_action_items_watchers_gin
  ON public.action_items USING GIN (watchers);

CREATE INDEX IF NOT EXISTS idx_action_items_created_by
  ON public.action_items(created_by_user_id);

-- =============================================================================
-- 5) Comments table (task_comments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.action_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON public.task_comments(created_at);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DROP POLICY IF EXISTS task_comments_admin_all ON public.task_comments;
CREATE POLICY task_comments_admin_all
  ON public.task_comments FOR ALL
  TO authenticated
  USING (
    public.has_role('admin'::public.app_role, auth.uid())
    OR public.has_role('moderator'::public.app_role, auth.uid())
  )
  WITH CHECK (
    public.has_role('admin'::public.app_role, auth.uid())
    OR public.has_role('moderator'::public.app_role, auth.uid())
  );

-- Users in the loop can read comments:
-- - creator, assignee, watcher
DROP POLICY IF EXISTS task_comments_select_in_loop ON public.task_comments;
CREATE POLICY task_comments_select_in_loop
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.action_items ai
      WHERE ai.id = task_comments.task_id
        AND (
          ai.created_by_user_id = auth.uid()
          OR ai.assigned_to_user_id = auth.uid()
          OR auth.uid() = ANY(ai.watchers)
          OR ai.assigned_by_user_id = auth.uid()
        )
    )
  );

-- Users in the loop can add comments (as themselves)
DROP POLICY IF EXISTS task_comments_insert_in_loop ON public.task_comments;
CREATE POLICY task_comments_insert_in_loop
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.action_items ai
      WHERE ai.id = task_comments.task_id
        AND (
          ai.created_by_user_id = auth.uid()
          OR ai.assigned_to_user_id = auth.uid()
          OR auth.uid() = ANY(ai.watchers)
          OR ai.assigned_by_user_id = auth.uid()
        )
    )
  );

-- =============================================================================
-- 6) Update Action Items RLS to include watchers + creator for SELECT
-- =============================================================================

-- Replace select policy to include creator + watchers
DROP POLICY IF EXISTS action_items_select_own ON public.action_items;
CREATE POLICY "action_items_select_own"
  ON public.action_items FOR SELECT
  TO authenticated
  USING (
    assigned_to_user_id = auth.uid()
    OR assigned_by_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR auth.uid() = ANY(watchers)
  );

-- Allow creator to update their own items (e.g., status / dates / reassignment)
DROP POLICY IF EXISTS action_items_update_creator ON public.action_items;
CREATE POLICY "action_items_update_creator"
  ON public.action_items FOR UPDATE
  TO authenticated
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

-- Allow creator / assignee / delegator to delete their own items
DROP POLICY IF EXISTS action_items_delete_creator ON public.action_items;
CREATE POLICY "action_items_delete_creator"
  ON public.action_items FOR DELETE
  TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR assigned_to_user_id = auth.uid()
    OR assigned_by_user_id = auth.uid()
  );


