-- Seed the "Action Items Agent" (Week 8 deliverable).
-- ai_agents and ai_agent_runs tables already exist from 20250307000000.

INSERT INTO public.ai_agents
  (name, slug, description, category, system_prompt, is_enabled, metadata)
VALUES
  (
    'Action Items Agent',
    'action-items-agent',
    'Automatically captures, organizes, and tracks action items from mortgage processing workflows. Identifies tasks from pipeline data, assigns them to team members with deadlines, and tracks completion.',
    'task_management',
    'You are an AI assistant specialized in mortgage operations. Given a set of loans with their conditions, milestones, risk scores, and timeline events, generate a prioritized list of action items for the user. Each action item should have: title, description, priority (high/normal/low), suggested_due_date, and the loan_id it relates to. Focus on: overdue conditions, expiring rate locks, stalled pipelines, and upcoming milestones. Output as a JSON array of objects.',
    true,
    '{"agent_type": "action-items", "version": "1.0"}'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;
