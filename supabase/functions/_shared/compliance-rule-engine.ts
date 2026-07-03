/**
 * _shared/compliance-rule-engine.ts
 *
 * Extracted from compliance-screening-agent so the deterministic rule
 * evaluation logic can be reused by other agents, tests, or future
 * cron-based compliance batch jobs without duplicating ~450 lines.
 *
 * Exports:
 *   - types: CheckResult, ComplianceCheckItem, ComplianceRule, CanonicalRule, EvalContext
 *   - mapCanonicalToLegacyShape()
 *   - evaluateRule()
 *   - businessDaysBetween()
 *   - estimateExpectedRate()
 *   - RateTier (type)
 *   - DEFAULT_RATE_TIERS
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type CheckResult = "pass" | "warning" | "fail";

export interface ComplianceCheckItem {
  code: string;
  regulation_group: string;
  name: string;
  result: CheckResult;
  actual_value: string;
  citation: string;
  issue_note: string;
  remediation?: string;
}

export interface ComplianceRule {
  code: string;
  regulation_group: string;
  name: string;
  description: string | null;
  check_field: string;
  operator: string;
  threshold: number | null;
  severity_on_fail: string;
  severity_on_warn: string | null;
  citation: string | null;
  remediation_hint: string | null;
}

export type CanonicalRule = {
  code: string;
  title: string;
  regulation_tag: string;
  severity: "info" | "warning" | "error";
  blocking: boolean;
  predicate: Record<string, unknown> | null;
  message_fail: string | null;
};

export type EvalContext = {
  loan: Record<string, unknown>;
  borrower: Record<string, unknown> | null;
  milestones: { milestone_type: string; completed_at: string | null; created_at: string }[];
  timelineEvents: { event_type: string; description: string | null; created_at: string }[];
  rateLock: { locked_rate: number | null } | null;
  creditScore: number | null;
  /** DB-loaded rate tiers from rate_tier_config. Falls back to DEFAULT_RATE_TIERS when absent. */
  rateTiers?: RateTier[];
};

// ─── Canonical → legacy shape adapter ───────────────────────────────────────

export function mapCanonicalToLegacyShape(rule: CanonicalRule): ComplianceRule {
  const predicate = rule.predicate ?? {};
  const rawPath = typeof predicate.path === "string" ? predicate.path : "";
  const entity = typeof predicate.entity === "string" ? predicate.entity : "loan";
  const path = rawPath.includes(":") ? rawPath : `${entity}:${rawPath}`;
  const op = typeof predicate.op === "string" ? predicate.op : "exists";
  const threshold =
    typeof predicate.value === "number"
      ? predicate.value
      : typeof predicate.max === "number"
        ? predicate.max
        : typeof predicate.min === "number"
          ? predicate.min
          : null;
  return {
    code: rule.code,
    regulation_group: rule.regulation_tag,
    name: rule.title,
    description: rule.message_fail,
    check_field: path,
    operator: op,
    threshold,
    severity_on_fail: rule.blocking || rule.severity === "error" ? "fail" : "warn",
    severity_on_warn: rule.severity === "warning" ? "warn" : null,
    citation: null,
    remediation_hint: null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getFieldValue(
  source: string,
  field: string,
  ctx: {
    loan: Record<string, unknown>;
    borrower: Record<string, unknown> | null;
    milestones: { milestone_type: string; completed_at: string | null }[];
    timelineEvents: { event_type: string; description: string | null }[];
  },
): unknown {
  if (source === "loan") return ctx.loan[field];
  if (source === "borrower") return ctx.borrower?.[field];
  if (source === "milestone") {
    const ms = ctx.milestones.find((m) => m.milestone_type === field);
    return ms?.completed_at ?? null;
  }
  return null;
}

export function getNumericField(
  source: string,
  field: string,
  ctx: {
    loan: Record<string, unknown>;
    borrower: Record<string, unknown> | null;
  },
): number | null {
  let raw: unknown;
  if (source === "loan") raw = ctx.loan[field];
  else if (source === "borrower") raw = ctx.borrower?.[field];
  else return null;
  if (raw == null) return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
}

export function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * A single credit-score → rate tier row.
 * Mirrors the `rate_tier_config` DB table (L6).
 */
export interface RateTier {
  min_credit_score: number;
  expected_rate: number;
}

/**
 * Fallback tiers used when the DB table is unreachable or returns no rows.
 * Kept in sync with the seed data in 20260408240000_rate_tier_config.sql.
 */
export const DEFAULT_RATE_TIERS: RateTier[] = [
  { min_credit_score: 760, expected_rate: 6.500 },
  { min_credit_score: 740, expected_rate: 6.625 },
  { min_credit_score: 720, expected_rate: 6.750 },
  { min_credit_score: 700, expected_rate: 6.875 },
  { min_credit_score: 680, expected_rate: 7.000 },
  { min_credit_score: 660, expected_rate: 7.250 },
  { min_credit_score: 640, expected_rate: 7.500 },
  { min_credit_score:   0, expected_rate: 7.750 },
];

/**
 * Returns the expected market rate for a given credit score.
 *
 * When `tiers` is supplied (loaded from `rate_tier_config`), it uses those;
 * otherwise falls back to DEFAULT_RATE_TIERS.  Tiers are evaluated in
 * descending min_credit_score order — first match wins.
 */
export function estimateExpectedRate(creditScore: number, tiers?: RateTier[]): number {
  const sorted = (tiers && tiers.length > 0 ? tiers : DEFAULT_RATE_TIERS)
    .slice()
    .sort((a, b) => b.min_credit_score - a.min_credit_score);

  for (const tier of sorted) {
    if (creditScore >= tier.min_credit_score) {
      return tier.expected_rate;
    }
  }
  // Should never reach here if tiers include a 0 floor, but be defensive
  return sorted[sorted.length - 1]?.expected_rate ?? 7.75;
}

// ─── Rule evaluation engine ──────────────────────────────────────────────────

export function evaluateRule(
  rule: ComplianceRule,
  ctx: EvalContext,
): ComplianceCheckItem {
  const item: ComplianceCheckItem = {
    code: rule.code,
    regulation_group: rule.regulation_group,
    name: rule.name,
    result: "pass",
    actual_value: "",
    citation: rule.citation ?? "",
    issue_note: "",
  };

  const setFail = (note: string, actual: string) => {
    item.result = (rule.severity_on_fail === "warn" ? "warning" : "fail") as CheckResult;
    item.issue_note = note;
    item.actual_value = actual;
  };
  const setWarn = (note: string, actual: string) => {
    if (rule.severity_on_warn === "warn") {
      item.result = "warning";
      item.issue_note = note;
      item.actual_value = actual;
    }
  };

  const [source, field] = rule.check_field.split(":");

  const op = String(rule.operator ?? "").trim();
  switch (op) {
    // ── Field existence checks ──────────────────────────────────────────
    case "not_empty": {
      const val = getFieldValue(source, field, ctx);
      item.actual_value = val ? String(val) : "Not provided";
      if (!val || (typeof val === "string" && val.trim() === "")) {
        setFail(`${rule.name}: required data is missing.`, "Not provided");
      }
      break;
    }

    case "exists": {
      if (source === "milestone") {
        const ms = ctx.milestones.find((m) => m.milestone_type === field);
        item.actual_value = ms?.completed_at
          ? `Completed ${ms.completed_at.split("T")[0]}`
          : "Not found";
        if (!ms || !ms.completed_at) {
          setFail(`${rule.name}: milestone not completed.`, "Not found");
        }
      } else {
        const val = getFieldValue(source, field, ctx);
        item.actual_value = val ? String(val) : "Not found";
        if (!val) {
          setFail(`${rule.name}: required item not found.`, "Not found");
        }
      }
      break;
    }

    // ── Numeric comparison ──────────────────────────────────────────────
    case "gt": {
      const val = getNumericField(source, field, ctx);
      item.actual_value = val != null ? String(val) : "Not provided";
      if (val == null || val <= (rule.threshold ?? 0)) {
        setFail(
          `${rule.name}: value ${val ?? "N/A"} does not exceed threshold ${rule.threshold}.`,
          item.actual_value,
        );
      }
      break;
    }

    // ── TRID timing checks ──────────────────────────────────────────────
    case "days_from_application_lte": {
      const ms = ctx.milestones.find((m) => m.milestone_type === field);
      const appDate = ctx.loan.created_at as string | null;
      if (!ms?.completed_at || !appDate) {
        item.actual_value = !ms?.completed_at ? "Milestone not completed" : "Application date missing";
        setFail(`${rule.name}: cannot verify timing — data missing.`, item.actual_value);
        break;
      }
      const days = businessDaysBetween(new Date(appDate), new Date(ms.completed_at));
      item.actual_value = `${days} business days`;
      if (days > (rule.threshold ?? 3)) {
        setFail(
          `${rule.name}: delivered in ${days} business days, exceeds ${rule.threshold}-day limit.`,
          item.actual_value,
        );
      } else if (days === (rule.threshold ?? 3)) {
        setWarn(
          `${rule.name}: delivered on the ${days}th business day — cutting it close.`,
          item.actual_value,
        );
      }
      break;
    }

    case "days_before_closing_gte": {
      const ms = ctx.milestones.find((m) => m.milestone_type === field);
      const closingMs = ctx.milestones.find(
        (m) => m.milestone_type === "closing" || m.milestone_type === "closing_date",
      );
      if (!ms?.completed_at) {
        item.actual_value = "Milestone not completed";
        setFail(`${rule.name}: disclosure not yet delivered.`, item.actual_value);
        break;
      }
      if (!closingMs?.completed_at) {
        item.actual_value = `Delivered ${ms.completed_at.split("T")[0]}, closing date not set`;
        setWarn(`${rule.name}: closing date not set — cannot verify timing.`, item.actual_value);
        break;
      }
      const days = businessDaysBetween(new Date(ms.completed_at), new Date(closingMs.completed_at));
      item.actual_value = `${days} business days before closing`;
      if (days < (rule.threshold ?? 3)) {
        setFail(
          `${rule.name}: only ${days} business day(s) before closing, minimum is ${rule.threshold}.`,
          item.actual_value,
        );
      }
      break;
    }

    // ── Property completeness ───────────────────────────────────────────
    case "all_present": {
      const fields = ["property_address", "property_city", "property_state", "property_postal_code"];
      const present = fields.filter(
        (f) => typeof ctx.loan[f] === "string" && (ctx.loan[f] as string).trim() !== "",
      );
      item.actual_value = `${present.length}/${fields.length} address fields`;
      if (present.length < fields.length) {
        const missing = fields.filter((f) => !present.includes(f));
        if (!present.includes("property_state") || !present.includes("property_city")) {
          setFail(`Missing critical fields: ${missing.join(", ")}.`, item.actual_value);
        } else {
          setWarn(`Missing fields: ${missing.join(", ")}.`, item.actual_value);
        }
      }
      break;
    }

    // ── Rate consistency ────────────────────────────────────────────────
    case "within_range_bps": {
      if (!ctx.rateLock?.locked_rate || ctx.creditScore == null) {
        item.actual_value = "Rate lock or credit score not available";
        item.result = "pass";
        item.issue_note = "Skipped — insufficient data for rate comparison.";
        break;
      }
      const expectedRate = estimateExpectedRate(ctx.creditScore, ctx.rateTiers);
      const actualRate = ctx.rateLock.locked_rate;
      const deltaBps = Math.abs(actualRate - expectedRate) * 100;
      item.actual_value = `Locked: ${actualRate.toFixed(3)}%, Expected: ~${expectedRate.toFixed(3)}%, Delta: ${deltaBps.toFixed(0)} bps`;
      if (deltaBps > (rule.threshold ?? 50)) {
        setWarn(
          `Rate deviates ${deltaBps.toFixed(0)} bps from expected tier pricing (threshold: ${rule.threshold} bps).`,
          item.actual_value,
        );
      }
      break;
    }

    // ── Conditional existence checks ────────────────────────────────────
    case "conditional_exists": {
      if (field === "pricing_exception_documented") {
        if (!ctx.rateLock?.locked_rate || ctx.creditScore == null) {
          item.actual_value = "N/A — no rate lock";
          break;
        }
        const expectedRate = estimateExpectedRate(ctx.creditScore, ctx.rateTiers);
        const deltaBps = Math.abs(ctx.rateLock.locked_rate - expectedRate) * 100;
        if (deltaBps <= 50) {
          item.actual_value = "No pricing exception needed";
          break;
        }
        const hasDoc = ctx.timelineEvents.some(
          (e) =>
            e.event_type === "pricing_exception" ||
            (e.description ?? "").toLowerCase().includes("pricing exception"),
        );
        item.actual_value = hasDoc ? "Exception documented" : "Exception NOT documented";
        if (!hasDoc) {
          setWarn(
            "Rate deviates from standard pricing but no pricing exception documentation found in timeline.",
            item.actual_value,
          );
        }
      } else if (field === "denial_documented") {
        const status = String(ctx.loan.status ?? "").toLowerCase();
        if (!["denied", "withdrawn", "adverse_action"].includes(status)) {
          item.actual_value = `Loan status: ${ctx.loan.status ?? "N/A"} — not applicable`;
          break;
        }
        const hasDenial = ctx.timelineEvents.some(
          (e) =>
            e.event_type === "denial" ||
            e.event_type === "adverse_action" ||
            (e.description ?? "").toLowerCase().includes("denial reason"),
        );
        item.actual_value = hasDenial ? "Denial reasons documented" : "Denial reasons NOT documented";
        if (!hasDenial) {
          setFail(
            "Loan is denied/withdrawn but no adverse action reasons found in timeline.",
            item.actual_value,
          );
        }
      }
      break;
    }

    // ── Occupancy–purpose consistency ────────────────────────────────────
    case "consistent": {
      const purpose = String(ctx.loan.purpose ?? "").toLowerCase();
      const occupancy = String(ctx.loan.occupancy_type ?? "").toLowerCase();
      if (!purpose || !occupancy) {
        item.actual_value = `Purpose: ${ctx.loan.purpose ?? "N/A"}, Occupancy: ${ctx.loan.occupancy_type ?? "N/A"}`;
        setWarn("Cannot verify consistency — purpose or occupancy missing.", item.actual_value);
        break;
      }
      item.actual_value = `Purpose: ${ctx.loan.purpose}, Occupancy: ${ctx.loan.occupancy_type}`;
      const investOcc = occupancy.includes("invest");
      const primaryOcc =
        occupancy.includes("primary") || occupancy.includes("principal") || occupancy.includes("owner");
      const purposeInvest = purpose.includes("invest");
      const purposePrimary =
        (purpose.includes("primary") && purpose.includes("residence")) || purpose.includes("principal residence");
      if (investOcc && purposePrimary && !purposeInvest) {
        setWarn(
          "Investment occupancy with primary-residence-only purpose may be inconsistent — verify with borrower.",
          item.actual_value,
        );
      } else if (primaryOcc && purposeInvest && !purposePrimary) {
        setWarn(
          "Primary occupancy with investment-stated purpose may be inconsistent — verify with borrower.",
          item.actual_value,
        );
      }
      break;
    }

    // ── HMDA: race, ethnicity, sex in one check ─────────────────────────
    case "hmda_demographics_complete": {
      const b = ctx.borrower;
      const race = b?.hmda_race != null && String(b.hmda_race).trim() !== "";
      const eth = b?.hmda_ethnicity != null && String(b.hmda_ethnicity).trim() !== "";
      const sex = b?.hmda_sex != null && String(b.hmda_sex).trim() !== "";
      const ok = race && eth && sex;
      item.actual_value = ok ? "Race, ethnicity, and sex present" : `Present: race=${race} ethnicity=${eth} sex=${sex}`;
      if (!ok) {
        setFail(
          `${rule.name}: collect HMDA demographic fields or record "Information not provided" where applicable.`,
          item.actual_value,
        );
      }
      break;
    }

    // ── TRID: LTV vs loan amount / appraised value ───────────────────────
    case "ltv_fee_consistency": {
      const amt = ctx.loan.loan_amount != null ? Number(ctx.loan.loan_amount) : null;
      const appr = ctx.loan.appraised_value != null ? Number(ctx.loan.appraised_value) : null;
      const ltvStored = ctx.loan.ltv != null ? Number(ctx.loan.ltv) : null;
      const tol = rule.threshold != null ? Number(rule.threshold) : 1.5;
      if (amt == null || appr == null || appr <= 0 || amt <= 0) {
        item.actual_value = "Loan amount or appraised value missing";
        setWarn(
          "Cannot verify fee tolerance — amount or value missing.",
          item.actual_value,
        );
        break;
      }
      const computed = (amt / appr) * 100;
      item.actual_value =
        ltvStored != null
          ? `Stated LTV ${ltvStored}% vs computed ${computed.toFixed(2)}%`
          : `Computed LTV ${computed.toFixed(2)}% (no stated LTV)`;
      if (ltvStored == null) {
        setWarn("Stated LTV missing — cannot cross-check for undisclosed fee drift.", item.actual_value);
        break;
      }
      const diff = Math.abs(computed - ltvStored);
      if (diff > tol) {
        setFail(
          `LTV implied by loan amount and value differs from stated LTV by ${diff.toFixed(2)}% (tolerance ${tol}%).`,
          item.actual_value,
        );
      } else if (diff > tol / 2) {
        setWarn(
          `LTV variance ${diff.toFixed(2)}% — review fees and rounding.`,
          item.actual_value,
        );
      }
      break;
    }

    // ── TRID: changed circumstance if LE revised ───────────────────────────
    case "changed_circumstance_if_le_revised": {
      const ms = ctx.milestones;
      const leCount = ms.filter((m) => m.milestone_type === "loan_estimate_sent").length;
      const hasRevisedMs = ms.some((m) =>
        (m.milestone_type ?? "").toLowerCase().includes("loan_estimate") &&
        (m.milestone_type ?? "").toLowerCase().includes("revis"),
      );
      const hasRevisedTimeline = ctx.timelineEvents.some((e) => {
        const d = (e.description ?? "").toLowerCase();
        const t = (e.event_type ?? "").toLowerCase();
        return (
          (d.includes("revised") && (d.includes("loan estimate") || d.includes("disclosure"))) ||
          (t.includes("loan_estimate") && t.includes("revis"))
        );
      });
      const revisionDetected = hasRevisedMs || hasRevisedTimeline || leCount > 1;
      if (!revisionDetected) {
        item.actual_value = "No Loan Estimate revision detected — N/A";
        break;
      }
      const hasDoc = ctx.timelineEvents.some((e) => {
        const d = (e.description ?? "").toLowerCase();
        const t = (e.event_type ?? "").toLowerCase();
        return t.includes("changed_circumstance") || d.includes("changed circumstance");
      });
      item.actual_value = hasDoc ? "Changed circumstance documented in timeline" : "Revision without changed-circumstance documentation";
      if (!hasDoc) {
        setWarn(
          "Loan Estimate appears revised — document the changed circumstance per TRID.",
          item.actual_value,
        );
      }
      break;
    }

    // ── HMDA: status / action evidence ─────────────────────────────────────
    case "hmda_status_action_evidence": {
      const hasStatusChange = ctx.timelineEvents.some((e) => e.event_type === "status_change");
      item.actual_value = hasStatusChange
        ? "Status change events present in timeline"
        : "No status_change timeline events";
      if (!hasStatusChange) {
        setWarn(
          "No status change events found — ensure action-taken dates can be supported for HMDA reporting.",
          item.actual_value,
        );
      }
      break;
    }

    // ── Fair Lending: comparable DTI/LTV treatment ─────────────────────
    case "fair_comparable_thresholds": {
      const dti = ctx.loan.dti != null ? Number(ctx.loan.dti) : null;
      const ltv = ctx.loan.ltv != null ? Number(ctx.loan.ltv) : null;
      if (dti == null || ltv == null) {
        item.actual_value = `DTI: ${dti ?? "N/A"}, LTV: ${ltv ?? "N/A"}`;
        setWarn(
          "DTI or LTV missing — cannot verify comparable threshold application.",
          item.actual_value,
        );
        break;
      }
      item.actual_value = `DTI ${dti}%, LTV ${ltv}%`;
      if (dti > 50 && ltv < 65) {
        setWarn(
          "Unusual profile: very high DTI with relatively low LTV — verify underwriting consistency.",
          item.actual_value,
        );
      } else if (dti < 28 && ltv > 95) {
        setWarn(
          "Unusual profile: very high LTV with low DTI — verify documentation and pricing consistency.",
          item.actual_value,
        );
      }
      break;
    }

    default:
      item.actual_value = "Unknown operator";
      item.issue_note = `Rule operator "${op}" is not implemented.`;
      item.result = "warning";
  }

  return item;
}
