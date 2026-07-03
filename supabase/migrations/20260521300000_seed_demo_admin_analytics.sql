-- Demo AI analytics for admin: sample agent runs + memories (hidden when integrations active).

DO $$
DECLARE
  admin_id   UUID;
  agent_id   UUID;
  conv_id    UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@collabai.software';
  IF admin_id IS NULL THEN
    RAISE NOTICE 'seed_demo_admin_analytics: admin@collabai.software not found — skipping';
    RETURN;
  END IF;

  SELECT id INTO agent_id FROM public.ai_agents WHERE slug = 'loan-coaching-agent' LIMIT 1;
  IF agent_id IS NULL THEN
    SELECT id INTO agent_id FROM public.ai_agents WHERE is_enabled = true ORDER BY created_at LIMIT 1;
  END IF;
  IF agent_id IS NULL THEN
    RAISE NOTICE 'seed_demo_admin_analytics: no ai_agents row — skipping';
    RETURN;
  END IF;

  -- Sample agent runs (8 rows)
  INSERT INTO public.ai_agent_runs (
    agent_id, user_id, input, output, status, latency_ms,
    provider_used, model_used, metadata, is_demo
  )
  SELECT agent_id, admin_id, v.input, v.output, 'completed', v.latency_ms,
         'lovable', 'google/gemini-2.5-flash', '{"demo":true}'::jsonb, true
  FROM (VALUES
    ('How do I explain a rate lock to a borrower?', 'A rate lock fixes your interest rate for a set period…', 1240),
    ('Which files are blocking clear-to-close on LN-DEMO-003?', 'Outstanding items: final VOE, hazard insurance binder…', 2100),
    ('Summarize FHA overlay changes from last month.', 'Key changes: manual underwriting thresholds, gift fund documentation…', 1890),
    ('Draft a polite follow-up for missing bank statements.', 'Hi [Borrower], we still need your last two months of bank statements…', 980),
    ('What is our current turn time for underwriting?', 'Median UW turn time this week: 2.4 business days (demo metric).', 760),
    ('Compare pipeline volume vs last month.', 'Application count up 12%; funded volume flat (demo analytics).', 1450),
    ('List coaching tips for first-time homebuyers.', 'Focus on budget, reserves, and document readiness early…', 1120),
    ('Flag loans with locks expiring in 7 days.', 'Demo: LN-DEMO-001, LN-DEMO-005 have locks expiring within 7 days.', 1340)
  ) AS v(input, output, latency_ms)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ai_agent_runs r
    WHERE r.user_id = admin_id AND r.is_demo = true AND r.input = v.input
  );

  -- Optional conversation shell for memory source_id
  SELECT id INTO conv_id FROM public.agent_conversations
  WHERE agent_id = agent_id AND user_id = admin_id AND title = 'Demo coaching session'
  LIMIT 1;

  IF conv_id IS NULL THEN
    conv_id := gen_random_uuid();
    INSERT INTO public.agent_conversations (id, agent_id, user_id, title, message_count, last_message_at)
    VALUES (conv_id, agent_id, admin_id, 'Demo coaching session', 2, now());
  END IF;

  INSERT INTO public.agent_memories (
    agent_id, user_id, memory_type, memory_category, content,
    source_type, source_id, importance_score, is_active, is_demo
  )
  SELECT agent_id, admin_id, v.memory_type, v.memory_category, v.content,
         'conversation', conv_id, v.importance_score, true, true
  FROM (VALUES
    ('long_term', 'preference', 'Admin prefers concise bullet summaries in coaching replies.', 0.75),
    ('semantic', 'fact', 'Demo pipeline uses LN-DEMO-001 through LN-DEMO-005 loan numbers.', 0.6),
    ('episodic', 'summary', 'Discussed rate lock education and missing document follow-ups.', 0.7),
    ('long_term', 'pattern', 'Often asks for pipeline prioritization before end of week.', 0.65)
  ) AS v(memory_type, memory_category, content, importance_score)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agent_memories m
    WHERE m.user_id = admin_id AND m.is_demo = true AND m.content = v.content
  );
END;
$$;
