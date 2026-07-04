-- Enable Loans and Mortgage Risk Copilot modules so sidebar links appear
-- for users with the right permissions (admin always bypasses module checks).

UPDATE public.module_settings
SET enabled = true, updated_at = now()
WHERE slug IN ('loans', 'mortgage_risk_copilot');

INSERT INTO public.module_settings (slug, name, description, enabled, display_order)
VALUES
  (
    'loans',
    'Loans Module',
    'Loan applications, borrowers, and loan pipeline.',
    true,
    10
  ),
  (
    'mortgage_risk_copilot',
    'Mortgage Risk Copilot',
    'AI-driven mortgage risk analysis, chat, and dashboard on loan files',
    true,
    35
  )
ON CONFLICT (slug) DO UPDATE
  SET enabled = true,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      display_order = EXCLUDED.display_order,
      updated_at = now();
