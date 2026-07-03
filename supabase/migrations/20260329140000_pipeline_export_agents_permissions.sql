-- Portfolio Summary + Pipeline Import/Export agent records, and seed loans:export for core roles.

INSERT INTO public.ai_agents (
  slug,
  name,
  description,
  category,
  system_prompt,
  data_sources,
  is_enabled,
  memory_enabled,
  metadata
) VALUES (
  'portfolio-summary-agent',
  'Portfolio Summary Agent',
  'Generates short narrative pipeline summaries from manager dashboard metrics (optional AI report).',
  'analysis',
  'You are a mortgage operations analyst. Given JSON metrics for a loan pipeline (counts by status, at-risk totals, lock expirations, bottlenecks), write a concise executive summary for a branch manager: 3–6 bullet points, plain English, no PII, actionable focus. End with one suggested priority for today.',
  ARRAY['loans', 'loan_risk_scores'],
  false,
  false,
  '{"type": "reporting"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ai_agents (
  slug,
  name,
  description,
  category,
  system_prompt,
  data_sources,
  is_enabled,
  memory_enabled,
  metadata
) VALUES (
  'pipeline-import-export-agent',
  'Pipeline Import / Export Agent',
  'Operational pipeline CSV/Excel export in the app; validated CSV import with dry-run. No LLM required for file I/O.',
  'operations',
  'Deterministic import and export of mortgage pipeline data. Validates rows and uses data_source + external_id for idempotent upserts.',
  ARRAY['loans', 'borrowers'],
  true,
  false,
  '{"type": "system", "capabilities": ["export_csv", "import_csv"]}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

UPDATE public.roles
SET permissions = (
  COALESCE(permissions::jsonb, '[]'::jsonb) || '["loans:export"]'::jsonb
)
WHERE slug IN ('branch_manager', 'loan_officer')
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) @> '["loans:export"]'::jsonb);
