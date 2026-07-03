# Mortgage modules roadmap — implementation status

This document compares the **Mortgage Software — Module Implementation Roadmap** ([docs/original/mortgage_modules_roadmap.pdf](original/mortgage_modules_roadmap.pdf)) to the current Control Tower codebase.

**Note:** `docs/original/mortgage_modules_roadmap.html` is not in the repository; the PDF is the source used for this matrix.

## Legend

| Status | Meaning |
|--------|---------|
| **Complete** | Feature set is substantially aligned with the roadmap module for a typical in-app workflow (UI + APIs/data where relevant). |
| **Partial** | Exists in some form (scaffold, sync from external LOS, AI assist, or subset of capabilities) but not the full scope described in the roadmap. |
| **Missing** | No meaningful implementation found (routes, edge functions, or domain-specific schema/workflow). |

---

## Phase 1 — Data foundation

| Module | Status | Notes |
|--------|--------|-------|
| Credit pull integration (tri-merge, bureau APIs) | **Partial (implemented)** | Integration card on Data Feeds tab (disabled by default). Manual entry always available. API pull via `pull-credit-report` edge function (vendor stub). Results stored in `credit_reports` table. Tabbed UI on BorrowerDetail and LoanDetail. |
| VOE / VOI verification | **Partial (implemented)** | Integration card (`voe-provider`) on Data Feeds tab. Manual entry always available. API verify via `verify-employment` edge function (vendor stub). Results in `employment_verifications` table. UI on BorrowerDetail/LoanDetail. |
| AVM (automated valuation model) | **Partial (implemented)** | Integration card (`avm-provider`) on Data Feeds tab. Manual entry always available. API request via `property-valuation` edge function (vendor stub). Results in `property_valuations` table with comparable sales. UI on BorrowerDetail/LoanDetail. |

---

## Phase 2 — Core origination

| Module | Status | Notes |
|--------|--------|-------|
| Loan origination system (LOS) | **Partial (enhanced)** | Unified 14-status lifecycle with DB trigger for timeline. State machine (`loan_stage_transitions`) with role gates. `transition-loan-status` edge function. Underwriter assignment + `/underwriting` queue. 1003 sections: assets, liabilities, REO, declarations. |
| Document management (DMS) | **Partial (enhanced)** | `document_types` taxonomy (23 types). `loan_documents` table + Supabase Storage bucket. Staff upload on LoanDetail. `program_document_requirements` checklist. `/documents/review` queue. Auto timeline on upload. |
| POS / borrower portal | **Complete** | Portal redeem/dashboard, invites, messaging, staff uploads, loan summary; DocuSign for disclosures. |
| Product & eligibility engine | **Partial (enhanced)** | `loan_programs.guidelines` JSONB (FICO/LTV matrices, property/occupancy/DTI rules). `check-eligibility` edge function uses Phase 1 data. Eligibility UI on LoanDetail. `/admin/loan-programs` admin page. |

---

## Phase 3 — Pricing & compliance

| Module | Status | Notes |
|--------|--------|-------|
| Pricing engine (multi-investor, full LLPA, lock-ready) | **Partial (enhanced)** | `pricing-calculate` with scenario fields (occupancy, purpose, property type, FTHB, etc.), JSONB LLPAs on `rate_sheet_products`, optional `investor_code` filter and `best_execution` across active sheets. Rate sheet upload / datastore import supports CSV + client Excel parse; `investor_code` + effective dates on upload. Migration `20260407120000_phase3_pricing_compliance.sql` adds columns + demo seed data. |
| Quick pricer | **Partial (implemented)** | `/pricing/quick` tab (permission `pricing:calculate`), minimal fields + `pricing-calculate` with defaults; LoanDetail links when user can calculate. |
| Compliance engine (TRID/RESPA/HMDA/NY real-time) | **Partial (enhanced)** | Deterministic `compliance_rules` + `compliance_rule_runs`, `run-compliance-rules` edge function, LoanDetail card; seeded sample rules. AI compliance-screening agent remains supplementary—not a certified regulatory engine. |
| Fee sheet / closing cost calculator (LE/CD-ready) | **Partial (implemented)** | `fee_template_versions`, `loan_fee_estimates`, `calculate-closing-costs` edge function; LoanDetail closing-costs card (illustrative disclaimers). |
| AUS integration (DU / LP) | **Partial (shell)** | `aus_submissions`, `submit-aus-request` stub, LoanDetail AUS panel; Data Feeds providers `aus-fannie-du`, `aus-freddie-lp` (disabled by default). No live vendor API until configured. |
| QC / pre-close audit | **Partial (implemented)** | `qc_checklist_templates`, `loan_qc_results`, checklist UI on LoanDetail with role-style gates via permissions. Distinct from AI precheck / file-risk agents. |

---

## Phase 4 — Rate lock & secondary market

| Module | Status | Notes |
|--------|--------|-------|
| Rate lock management | **Partial (enhanced)** | Migration `20260409120000_phase4_rate_lock_secondary_market.sql` adds lock traceability columns; `rate-locks` syncs `loans.lock_date` / `lock_expiration_date` on create/extend/relock. LoanDetail **Rate lock** card; calculator & quick pricer **Request lock** when `quote_type === lock_eligible`. Locks page tab **Locks in my scope** (`useRateLocksInScope`). |
| Best execution engine | **Partial (enhanced)** | `loan_pricing_snapshots` + save from calculator / auto-save on quick pricer with loanId. LoanDetail **Best execution snapshot** strip; link to calculator with `loanId` + `bestExecution=1`. |
| Pipeline management dashboard | **Partial (enhanced)** | Manager Dashboard **Locks expiring in 7 days** drill-down (reconciles `loans.lock_expiration_date` and active `rate_locks`); investor status column from `investor_submissions`. Summary CSV includes `lock_expiring` rows. |
| Investor submission portal | **Partial (implemented)** | `investor_submissions` + RLS (incl. branch manager mutate); LoanDetail **Investor delivery** card + Documents anchor; `/pricing/investor-submissions` scoped list; `submit-investor-package` stub; Integration Hub `investor-tpo-connector` (default off). |
| Hedge analytics | **Partial (implemented)** | Same as above plus `optional_symbol` on snapshots, recharts **volume vs pull-through** chart on `/pricing/hedge`, optional benchmark label on compute. |

### Phase 4 QA checklist (regression)

- **Pricing:** Run `pricing-calculate` from full calculator and quick pricer with and without `best_execution`; confirm Phase 3 compliance / QC cards still load on LoanDetail.
- **Locks:** Create / extend / relock from LoanDetail; confirm `loans.lock_expiration_date` updates and Manager Dashboard expiring table reflects the loan within 7 days.
- **Snapshots:** Save snapshot from calculator; confirm LoanDetail best-exec card and “Fill from last pricing snapshot” on the rate lock card.
- **Investor:** Create draft, change status, run **Log vendor submit (stub)**; confirm `metadata.submit_stub` on row when connector is disabled.
- **Hedge:** As branch manager or admin, open **Pricing → Hedge**, run **Compute snapshot**, export CSV.
- **Integrations:** New Data Feeds cards save with **inactive** by default; validate key only checks URL shape (same pattern as other stubs).
- **Exports:** Pipeline loan CSV/Excel includes **`pricing_investor_code`** (latest `loan_pricing_snapshots.winner_investor_code`).
- **DB:** Apply `20260410140000_phase4_gaps_investor_bm_hedge_symbol.sql` for BM investor mutate + `optional_symbol`; redeploy **`compute-hedge-snapshot`**.

---

## Phase 5 — Closing & digital execution

| Module | Status | Notes |
|--------|--------|-------|
| eSign / eClose / eNote | Partial | DocuSign for disclosures; **manual eClose/eNote checklist** per loan (`loan_digital_closing`); optional **`eclose-platform-stub`** in Integrations (off by default). |
| RON (remote online notarization) | Partial | **Manual RON sessions** on loan detail (`loan_ron_sessions`); **`ron-provider-stub`** in Integrations. |
| Flood / title / insurance ordering | Partial | **Manual settlement orders** (`loan_settlement_orders`); vendor stubs **`flood-cert-vendor-stub`**, **`title-vendor-stub`**, **`homeowners-insurance-vendor-stub`**. |
| Appraisal management | Partial | **Manual appraisal rows** (`loan_appraisal_orders`); **`appraisal-amc-stub`**. |
| Adverse action notice generator | Partial | **Draft text builder + copy** on loan (`loan_adverse_actions`); not legal advice. **`adverse-action-notice-stub`** for future mailing integration. |

**DB:** apply `20260411120000_phase5_closing_digital_execution.sql`.

---

## Phase 6 — Borrower experience & leads

| Module | Status | Notes |
|--------|--------|-------|
| Lead management / CRM | Partial | Clients module—generic CRM, not mortgage-specific lead scoring/nurture as in roadmap. |
| Pre-qual / pre-approval calculator | Partial | Internal `/pricing/prequal` (permission `pricing:calculate`) and public `/prequal-public`; shared `PrequalCalculatorCore`. |
| Mortgage calculator widget | Partial | Public `/mortgage-calculator-widget`; `MortgageCalculatorWidgetCore` payment breakdown widget. |
| Co-branded marketing engine | Missing | |
| Automated borrower comms | Partial | Send borrower email, milestone comm drafts, borrower updates, approval workflow for comms. |

---

## Phase 7 — Compliance reporting & licensing

| Module | Status | Notes |
|--------|--------|-------|
| HMDA reporting | Partial | Manual HMDA LAR data capture per loan (`hmda_lar_entries`), admin reporting page (`/admin/hmda-reporting`), CSV export + run logs (`hmda_report_runs`). |
| NMLS / licensing tracker | Partial | Admin tracker (`/admin/licensing-tracker`) backed by `nmls_licenses`; includes status + expiration visibility and search. |

---

## Phase 8 — Analytics & optimization

| Module | Status | Notes |
|--------|--------|-------|
| LO performance dashboard | Partial | Leaderboard / badges / compute-leaderboard; branch performance coach agent—not necessarily full revenue-per-LO analytics. |
| Margin & profitability analytics | Missing | |
| Turn time / SLA tracking | Partial | Admin SLA management; not full stage-by-stage SLA engine across pipeline. |
| Pipeline reporting | Partial | Manager views + pipeline agents/summary functions. |
| Investor comparison analytics | Missing | |

---

## Quick reference — by status

### Complete (strong fit for roadmap intent)

- POS / borrower portal (as implemented: invites, dashboard, messaging, uploads, DocuSign for disclosures)

### Partial (implemented in part or lighter than roadmap)

- Credit pull (Phase 1 — integration card, manual entry, API stub, credit_reports table)
- VOE / VOI (Phase 1 — integration card, manual entry, API stub, employment_verifications table)
- AVM (Phase 1 — integration card, manual entry, API stub, property_valuations table)
- LOS (Phase 2 — 14-status lifecycle, state machine, underwriter queue, 1003 sections)
- DMS (Phase 2 — document taxonomy, loan_documents, staff upload, checklist, review queue)
- Product & eligibility (Phase 2 — guidelines JSONB, check-eligibility engine, admin page)
- Pricing engine / calculator / quick pricer (Phase 3 — LLPAs, multi-investor, best execution flag)
- Compliance engine (deterministic rules + runs + agents)
- QC / pre-close (checklist on loan + AI/risk assist)
- Rate lock management (LoanDetail, lock sync to loan, scoped lock list)
- Best execution snapshot on loan file
- Pipeline management dashboard (lock expiring drill-down, investor badge)
- Investor submission workflow (manual + stub connector)
- Hedge analytics (manual snapshot from locks)
- Closing execution — manual eClose checklist, RON rows, settlement orders, appraisals, adverse action drafts (Phase 5)
- HMDA LAR capture + admin reporting; NMLS licensing tracker (Phase 7)
- eSign (DocuSign path only)
- Lead / CRM (Clients)
- Pre-qual / mortgage calculator (dedicated pages: `/pricing/prequal`, `/prequal-public`, `/mortgage-calculator-widget`)
- Automated borrower comms
- LO performance (leaderboard / gamification / coach)
- Turn time / SLA (admin SLA)
- Pipeline reporting

### Missing
- Certified TRID LE/CD engine (illustrative fee estimate only)
- Live AUS (DU/LP) vendor connectivity
- Full secondary-market best execution / commitment desk
- Live investor TPO HTTPS delivery (stub only until vendor enabled)
- Institutional trading-grade hedge / marks feed
- Full certified eClose / eNote platform (beyond DocuSign disclosures + manual checklist)
- Live RON vendor connectivity (manual session tracking exists)
- Live flood / title / insurance vendor ordering (manual orders + stubs exist)
- Full AMC appraisal workflow (manual orders + stub exist)
- Production adverse action mailing / legal workflow (draft builder exists)
- Co-branded marketing engine
- Margin & profitability analytics
- Investor comparison analytics

---

## Primary code anchors (for verification)

| Area | Where to look |
|------|----------------|
| Routes | `src/App.tsx` |
| Loans / borrowers | `src/pages/Loans.tsx`, `LoanDetail.tsx`, `Borrowers.tsx` |
| Portal | `src/pages/portal/*`, `supabase/functions/portal-*` |
| Pricing / locks / Phase 3–4 | `src/pages/pricing/*`, `supabase/functions/pricing-calculate`, `rate-locks`, `submit-investor-package`, `compute-hedge-snapshot`, `src/components/loans/phase3/*`, `src/components/loans/phase4/*`, `supabase/migrations/20260407120000_phase3_pricing_compliance.sql`, `supabase/migrations/20260409120000_phase4_rate_lock_secondary_market.sql` |
| Pipeline / manager | `src/pages/ManagerDashboard.tsx` |
| Compliance | `src/pages/admin/ComplianceRules.tsx`, `supabase/functions/compliance-screening-agent`, `import-compliance-rules` |
| Phase 5 (Closing / eClose) | `src/components/loans/phase5/*`, `src/hooks/useClosingExecution.ts`, `supabase/migrations/20260411120000_phase5_closing_digital_execution.sql` |
| Phase 6 (Calculators) | `src/pages/PrequalCalculator.tsx`, `PublicPrequalCalculator.tsx`, `MortgageCalculatorWidget.tsx`, `src/components/mortgage/*`, `src/lib/mortgageMath.ts` |
| Phase 7 (HMDA / Licensing) | `src/pages/admin/HmdaReporting.tsx`, `src/pages/admin/LicensingTracker.tsx`, `src/components/loans/phase7/LoanHmdaCard.tsx`, `src/hooks/usePhase7Compliance.ts`, `supabase/migrations/20260412120000_phase7_compliance_reporting_licensing.sql` |
| DocuSign | `supabase/functions/docusign-*`, `src/components/admin/DocuSignIntegrationCard.tsx` |
| LOS sync | `supabase/functions/los-sync-lendingpad` |
| Borrower comms | `supabase/functions/send-borrower-email`, `auto-draft-milestone-comm`, `generate-borrower-update`, `approve-borrower-communication` |
| Leaderboard / performance | `supabase/functions/compute-leaderboard`, `src/hooks/useLeaderboard.ts`, `src/components/leaderboard/*` |
| Data Foundation (Phase 1) | `src/hooks/useDataFoundation.ts`, `src/components/data-foundation/*`, `supabase/functions/pull-credit-report`, `supabase/functions/verify-employment`, `supabase/functions/property-valuation`, `supabase/migrations/20260406100000_data_foundation_phase1.sql` |
| Core Origination (Phase 2) | `src/hooks/useLoanTransitions.ts`, `src/hooks/useLoanApplication.ts`, `src/hooks/useLoanDocuments.ts`, `src/hooks/useEligibility.ts`, `src/components/loans/application/*`, `src/components/loans/documents/*`, `src/components/loans/eligibility/*`, `supabase/functions/transition-loan-status`, `supabase/functions/check-eligibility`, `supabase/migrations/20260406200000_phase2_core_origination.sql` |

---

*Last updated after Phase 5–7 and borrower calculator surfaces; backlog UI at `/docs/backlog`. Re-run comparison when major modules ship.*
