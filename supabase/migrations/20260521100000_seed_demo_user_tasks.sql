-- Demo tasks + notifications for the standard "user" role (demo@collabai.software).
-- Idempotent via fixed dedupe keys and loan-number guards.

DO $$
DECLARE
  demo_user_id UUID;
BEGIN
  SELECT id INTO demo_user_id FROM auth.users WHERE email = 'demo@collabai.software';
  IF demo_user_id IS NULL THEN
    RAISE NOTICE 'seed_demo_user_tasks: demo@collabai.software not found — skipping';
    RETURN;
  END IF;

  -- 5 open tasks assigned to demo user
  INSERT INTO public.tasks (title, description, status, priority, assigned_to, created_by, due_date, is_demo)
  SELECT v.title, v.description, v.status, v.priority, demo_user_id, demo_user_id, v.due_date, true
  FROM (VALUES
    ('Review shared knowledge article', 'Read the FHA overlay summary in the knowledge base.', 'open', 'medium', (now() + interval '2 days')::timestamptz),
    ('Complete security awareness quiz', 'Annual training assigned by admin.', 'open', 'low', (now() + interval '5 days')::timestamptz),
    ('Acknowledge pipeline policy update', 'Confirm you have read the March pipeline bulletin.', 'in_progress', 'medium', (now() + interval '1 day')::timestamptz),
    ('Submit feedback on AI agent catalog', 'Share one improvement idea for the assistant list.', 'open', 'low', (now() + interval '7 days')::timestamptz),
    ('Prepare for team standup', 'Note blockers and wins from this week.', 'open', 'high', (now() + interval '12 hours')::timestamptz)
  ) AS v(title, description, status, priority, due_date)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.assigned_to = demo_user_id AND t.is_demo = true AND t.title = v.title
  );

  -- 3 notifications
  INSERT INTO public.notifications (user_id, title, message, type, link, dedupe_key, is_demo)
  SELECT demo_user_id, v.title, v.message, v.type, v.link, v.dedupe_key, true
  FROM (VALUES
    ('Welcome to MCT Lite', 'Your workspace is ready. Explore tasks, knowledge, and AI agents.', 'info', '/dashboard', 'demo:notif:welcome'),
    ('New knowledge article published', 'FHA overlay summary was added to the shared library.', 'success', '/knowledge', 'demo:notif:knowledge'),
    ('AI agents enabled for your role', 'Open the agent catalog to try assistants available to you.', 'info', '/agents', 'demo:notif:agents')
  ) AS v(title, message, type, link, dedupe_key)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;
