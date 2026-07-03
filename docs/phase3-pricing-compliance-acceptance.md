# Phase 3 Pricing & Compliance Acceptance Matrix

This matrix maps manager validation points to concrete verification steps and expected outcomes.

## Environment Preconditions

- Migrations applied through:
  - `20260313110000_pricing_and_rate_locks.sql`
  - `20260407120000_phase3_pricing_compliance.sql`
  - `20260408150000_rename_agent_compliance_rules_for_phase3.sql`
- Functions deployed:
  - `pricing-calculate`
  - `pricing-rate-sheets-upload`
  - `validate-api-key`
  - `calculate-closing-costs`
  - `run-compliance-rules`
  - `submit-aus-request`
  - `import-loan-program-guidelines`
  - Optional: `import-compliance-rules`, `compliance-screening-agent`
- Test user has `pricing:calculate` and required module permissions.

## Functional Matrix

| Area | Test | Expected |
|---|---|---|
| Pricing Calculator | Run `/pricing` with loan amount, FICO, state (+ optional occupancy/purpose/property) | Response renders without 500; products or explicit no-match message shown |
| Quick Quote | Run `/pricing/quick` with minimal fields | Quote result appears and errors are user-readable |
| Quick Quote Hydration | Open Loan Detail, click **Quick price** | `loanId` query param present and fields prefilled from loan |
| Datastore Upload CSV | Upload CSV in `/pricing/datastores` | Rate sheet created and row count returned |
| Datastore Upload Excel | Upload `.xlsx/.xls` in `/pricing/datastores` | Parsed rows saved as `rate_sheet_products` |
| Investor/Best Execution | Quote with `investor_code`, `best_execution`, and both combined | No 500; constrained/cross-sheet behavior works as configured |
| Closing Costs Card | Preview + Save on Loan Detail | Totals/disclaimer displayed; persisted estimate visible in history |
| Compliance Card | Run checks on Loan Detail | Run persisted, pass/fail rows populated, summary returned |
| Compliance Hard Block | Attempt status progression after blocking fail | Transition denied except risk-exit statuses (`denied/withdrawn/suspended`) |
| QC Checklist | Mark items pass/fail/na + sign-off | Updates persist in `loan_qc_results`; sign-off stamps written |
| AUS Stub | Submit DU/LPA from Loan Detail | `aus_submissions` row created with stub status/mode in response |
| Compliance Rules Admin | List/toggle/edit/import in Admin | Reads/writes canonical `public.compliance_rules` |
| Guidelines Import | Dry-run then apply import | Dry-run reports only, apply updates program guidelines |
| Integration Test | Run Data Feed/API key tests | `validate-api-key` returns `valid` with typed mode/details |
| Regression Loans CRUD | Create/edit/view/delete loan | Existing workflows unchanged |
| Regression Documents | Upload/review docs in Loan Detail | Existing document flows unchanged |

## API Smoke Calls (Recommended)

Use these as deployment smoke tests after function deploy:

1. `run-compliance-rules` with a known `loan_id` that should fail at least one blocking rule.
2. `transition-loan-status` for that loan to a progressing status (expect block), then to `suspended` (expect allowed).
3. `pricing-calculate` with valid and invalid `state` payloads (expect `200` and `400`).
4. `pricing-rate-sheets-upload` with malformed dates or investor code (expect `400`).
5. `validate-api-key` for OpenAI plus one stub feed provider (verify `mode` semantics).

## Sign-off Criteria

- No Phase 3 target path returns unhandled 500 for valid/invalid inputs.
- Compliance rule admin changes affect runtime deterministic checks.
- Blocking compliance failures prevent unauthorized progression.
- Known limitations remain explicit: AUS/vendor feeds may be stubbed without live credentials.
