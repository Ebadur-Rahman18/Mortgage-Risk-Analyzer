-- Custom role for internal support / processor users (assign via Admin → Users → custom role).
-- Aligns with app fallback permissions for app_role `user`: tasks + knowledge + AI chat only.
INSERT INTO public.roles (name, description, permissions)
VALUES (
  'Support Staff',
  'Internal ops or processor: assigned tasks, action items, knowledge, and AI chat; no loan pipeline or borrower management.',
  '["tasks:read","tasks:update","knowledge:read","ai_chat:read"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;
