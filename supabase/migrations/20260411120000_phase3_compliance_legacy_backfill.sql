-- Phase 3 hardening: keep legacy compliance catalog synchronized from canonical
-- deterministic rules table. Canonical source of truth remains public.compliance_rules.

DO $$
BEGIN
  IF to_regclass('public.compliance_rules_agent_legacy') IS NULL THEN
    RAISE NOTICE 'public.compliance_rules_agent_legacy not found; skipping legacy backfill.';
    RETURN;
  END IF;

  INSERT INTO public.compliance_rules_agent_legacy (
    code,
    regulation_group,
    name,
    description,
    check_field,
    operator,
    threshold,
    severity_on_fail,
    severity_on_warn,
    citation,
    remediation_hint,
    enabled,
    updated_at
  )
  SELECT
    c.code,
    CASE
      WHEN c.regulation_tag IN ('TRID', 'HMDA', 'Fair Lending') THEN c.regulation_tag
      WHEN c.regulation_tag = 'RESPA' THEN 'TRID'
      ELSE 'Fair Lending'
    END,
    c.title,
    COALESCE(c.message_fail, c.message_pass, c.title || ' failed.'),
    CASE
      WHEN COALESCE((c.predicate->>'path'), '') = '' THEN 'loan:unknown'
      WHEN position(':' in (c.predicate->>'path')) > 0 THEN c.predicate->>'path'
      ELSE COALESCE(c.predicate->>'entity', 'loan') || ':' || (c.predicate->>'path')
    END,
    COALESCE(c.predicate->>'op', 'exists'),
    CASE
      WHEN jsonb_typeof(c.predicate->'value') = 'number' THEN (c.predicate->>'value')::numeric
      WHEN jsonb_typeof(c.predicate->'max') = 'number' THEN (c.predicate->>'max')::numeric
      WHEN jsonb_typeof(c.predicate->'min') = 'number' THEN (c.predicate->>'min')::numeric
      ELSE NULL
    END,
    CASE
      WHEN c.blocking OR c.severity = 'error' THEN 'fail'
      ELSE 'warn'
    END,
    CASE
      WHEN c.severity = 'warning' THEN 'warn'
      ELSE NULL
    END,
    NULL,
    NULL,
    c.is_active,
    now()
  FROM public.compliance_rules c
  ON CONFLICT (code) DO UPDATE
  SET
    regulation_group = EXCLUDED.regulation_group,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    check_field = EXCLUDED.check_field,
    operator = EXCLUDED.operator,
    threshold = EXCLUDED.threshold,
    severity_on_fail = EXCLUDED.severity_on_fail,
    severity_on_warn = EXCLUDED.severity_on_warn,
    enabled = EXCLUDED.enabled,
    updated_at = now();

  COMMENT ON TABLE public.compliance_rules_agent_legacy IS
    'Legacy compatibility catalog. Canonical source is public.compliance_rules (Phase 3).';
END $$;
