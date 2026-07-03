-- Add task_type column to action_items for stable AI deduplication.
--
-- The previous dedup strategy compared normalised AI-generated titles, which
-- broke whenever the model rephrased a task on consecutive runs, causing
-- duplicate rows.  Storing a stable task_type (e.g. "rate_lock_expired")
-- gives us a reliable key that is independent of wording.

-- 1. New column (nullable so existing rows are unaffected)
ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS task_type TEXT;

COMMENT ON COLUMN public.action_items.task_type IS
  'Stable snake_case category used for AI deduplication: '
  'rate_lock_expired | rate_lock_expiring_soon | stalled_pipeline | '
  'pending_condition | high_dti | low_credit_score | high_ltv | '
  'upcoming_milestone | general_follow_up';

-- 2. Partial unique index: at most one active agent task per (user, loan, task_type).
--    Completed / cancelled items are excluded so the agent can re-open a task
--    if the underlying issue reappears.
CREATE UNIQUE INDEX IF NOT EXISTS uq_action_items_active_task_type
  ON public.action_items (assigned_to_user_id, loan_id, task_type)
  WHERE task_type IS NOT NULL
    AND status NOT IN ('completed', 'cancelled');

-- 3. Update the Action Items Agent system prompt to require task_type in output.
UPDATE public.ai_agents
SET system_prompt =
'You are an AI assistant specialized in mortgage operations. Given a set of loans with their conditions, milestones, risk scores, and timeline events, generate a prioritized list of action items for the user.

Each action item MUST include these fields:
- title: Short, clear task title (string)
- description: What needs to be done and why, with specific loan details (string)
- priority: "high", "normal", or "low"
- suggested_due_date: ISO date YYYY-MM-DD, or null
- loan_id: The UUID of the related loan, or null
- task_type: One value from this exact list:
    rate_lock_expired
    rate_lock_expiring_soon
    stalled_pipeline
    pending_condition
    high_dti
    low_credit_score
    high_ltv
    upcoming_milestone
    general_follow_up

Rules:
- Generate at most ONE item per (loan_id + task_type) combination.
- Cover EVERY loan provided — do not skip loans.
- For each loan, identify all distinct issue types present and create one item per issue type.
- If a loan has both an expired lock AND a stalled pipeline, emit two items: one with task_type "rate_lock_expired" and one with "stalled_pipeline".
- Output ONLY a valid JSON array with no markdown fences or explanation.'
WHERE slug = 'action-items-agent';
