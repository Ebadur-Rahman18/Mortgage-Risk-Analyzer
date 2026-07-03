-- Align Compliance Screening rules with TRID / HMDA / Fair Lending product spec (15 active checks).

-- TRID: fee tolerance + changed circumstance (replace redundant LE/CD "exists" checks)
UPDATE public.compliance_rules SET
  name = 'Fee Tolerance (Amount / Value / LTV)',
  description = 'Loan amount, appraised value, and stated LTV should align (no undisclosed fee drift).',
  check_field = 'loan:ltv_fee',
  operator = 'ltv_fee_consistency',
  threshold = 1.5,
  severity_on_fail = 'warn',
  severity_on_warn = 'warn',
  citation = '12 CFR §1026.19(e)(1)(iii); §1026.4',
  remediation_hint = 'Reconcile loan amount, appraised value, and disclosed LTV; document fee changes.',
  updated_at = now()
WHERE code = 'TRID-003';

UPDATE public.compliance_rules SET
  name = 'Changed Circumstance Documentation',
  description = 'If the Loan Estimate was revised, the timeline must document the changed circumstance.',
  check_field = 'timeline:le_revision',
  operator = 'changed_circumstance_if_le_revised',
  threshold = NULL,
  severity_on_fail = 'warn',
  severity_on_warn = 'warn',
  citation = '12 CFR §1026.19(e)(3)(iv)',
  remediation_hint = 'Add a timeline entry describing the changed circumstance and revised LE.',
  updated_at = now()
WHERE code = 'TRID-004';

-- HMDA: single combined demographic check; retire duplicate ethnicity/sex rows
UPDATE public.compliance_rules SET
  name = 'Borrower Demographic Data (HMDA)',
  description = 'Race, ethnicity, and sex for HMDA LAR (or recorded as declined / not provided).',
  check_field = 'borrower:hmda_demographics',
  operator = 'hmda_demographics_complete',
  threshold = NULL,
  severity_on_fail = 'fail',
  severity_on_warn = NULL,
  citation = '12 CFR §1003.4(a)(10)',
  remediation_hint = 'Collect HMDA demographic fields per GIR.',
  updated_at = now()
WHERE code = 'HMDA-001';

UPDATE public.compliance_rules SET enabled = false, updated_at = now() WHERE code IN ('HMDA-002', 'HMDA-003');

INSERT INTO public.compliance_rules (
  code, regulation_group, name, description, check_field, operator, threshold,
  severity_on_fail, severity_on_warn, citation, remediation_hint
) VALUES (
  'HMDA-007',
  'HMDA',
  'Action Taken / Status Transitions',
  'Status changes should be recorded in the timeline to support HMDA action-taken dating.',
  'timeline:status_action',
  'hmda_status_action_evidence',
  NULL,
  'warn',
  'warn',
  '12 CFR §1003.4(a)(8)',
  'Log status changes to the loan timeline with accurate timestamps.'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.compliance_rules (
  code, regulation_group, name, description, check_field, operator, threshold,
  severity_on_fail, severity_on_warn, citation, remediation_hint
) VALUES (
  'FAIR-005',
  'Fair Lending',
  'Comparable DTI / LTV Treatment',
  'DTI and LTV should be plausible together — flag outlier combinations for review.',
  'loan:dti_ltv_comparison',
  'fair_comparable_thresholds',
  NULL,
  'warn',
  'warn',
  'ECOA Regulation B §1002.4(a)',
  'Verify underwriting and pricing decisions are applied consistently across borrowers.'
)
ON CONFLICT (code) DO NOTHING;
