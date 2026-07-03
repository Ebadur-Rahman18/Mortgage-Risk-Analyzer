-- Flag demo/sample rows that should be hidden once real integrations are connected.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ai_agent_runs
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.agent_memories
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasks.is_demo IS 'Sample task for empty-state UX; hidden when LOS/CRM integrations are active.';
COMMENT ON COLUMN public.notifications.is_demo IS 'Sample notification; hidden when integrations are active.';
COMMENT ON COLUMN public.ai_agent_runs.is_demo IS 'Sample agent run for admin analytics demo; hidden when integrations are active.';
COMMENT ON COLUMN public.agent_memories.is_demo IS 'Sample extracted memory; hidden when integrations are active.';

CREATE INDEX IF NOT EXISTS idx_tasks_is_demo ON public.tasks(is_demo) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_notifications_is_demo ON public.notifications(is_demo) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_is_demo ON public.ai_agent_runs(is_demo) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_agent_memories_is_demo ON public.agent_memories(is_demo) WHERE is_demo = true;
