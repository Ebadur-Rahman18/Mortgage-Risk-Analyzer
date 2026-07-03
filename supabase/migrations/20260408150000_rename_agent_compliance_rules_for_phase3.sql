-- Phase 3 introduced a different public.compliance_rules shape (predicate JSONB, title, …).
-- The compliance screening agent migration (20260402150000) created the OLD catalog
-- (check_field, operator, regulation_group, …). CREATE TABLE IF NOT EXISTS in Phase 3
-- skipped creating the new table, so seeds failed with "column predicate does not exist".
--
-- This migration moves the AI/screening catalog aside so Phase 3 can own public.compliance_rules.
-- App + import-compliance-rules + compliance-screening-agent target compliance_rules_agent_legacy.

DO $$
BEGIN
  IF to_regclass('public.compliance_rules') IS NULL THEN
    RAISE NOTICE 'public.compliance_rules does not exist; nothing to rename.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'check_field'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'predicate'
  ) THEN
    IF to_regclass('public.compliance_rules_agent_legacy') IS NOT NULL THEN
      RAISE EXCEPTION 'Rename blocked: public.compliance_rules_agent_legacy already exists. Drop or rename it manually, then re-run.';
    END IF;
    ALTER TABLE public.compliance_rules RENAME TO compliance_rules_agent_legacy;
    COMMENT ON TABLE public.compliance_rules_agent_legacy IS
      'Legacy AI compliance screening catalog (check_field/operator). Use public.compliance_rules for Phase 3 deterministic rules.';
  ELSE
    RAISE NOTICE 'public.compliance_rules already looks like Phase 3 (or mixed); skip rename.';
  END IF;
END $$;
