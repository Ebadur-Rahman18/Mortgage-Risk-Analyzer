INSERT INTO public.roles (name, description, permissions)
SELECT 'Support Staff',
       'Support / processor — minimal nav: Tasks, Action Items, Knowledge, AI Chat, Notifications.',
       '["tasks:read","tasks:update","knowledge:read","ai_chat:read"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE name = 'Support Staff'
);