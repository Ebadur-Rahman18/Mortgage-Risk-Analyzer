/** DTI and LTV helpers for Mortgage Risk Copilot (Requirements §9). */

export interface DtiLtvInputs {
  monthlyDebt?: number | null;
  annualIncome?: number | null;
  loanAmount?: number | null;
  propertyValue?: number | null;
}

export function calculateDti(monthlyDebt: number, annualIncome: number): number | null {
  if (!annualIncome || annualIncome <= 0) return null;
  const monthlyIncome = annualIncome / 12;
  if (monthlyIncome <= 0) return null;
  return Math.round((monthlyDebt / monthlyIncome) * 10000) / 100;
}

export function calculateLtv(loanAmount: number, propertyValue: number): number | null {
  if (!propertyValue || propertyValue <= 0) return null;
  return Math.round((loanAmount / propertyValue) * 10000) / 100;
}

export function computeDtiLtv(inputs: DtiLtvInputs): { dti: number | null; ltv: number | null } {
  const dti =
    inputs.monthlyDebt != null &&
    inputs.annualIncome != null &&
    inputs.annualIncome > 0
      ? calculateDti(inputs.monthlyDebt, inputs.annualIncome)
      : null;

  const ltv =
    inputs.loanAmount != null &&
    inputs.propertyValue != null &&
    inputs.propertyValue > 0
      ? calculateLtv(inputs.loanAmount, inputs.propertyValue)
      : null;

  return { dti, ltv };
}

/** Map loan pipeline status to Requirements display groups. */
export const COPILOT_STATUS_GROUPS = {
  pending: ["draft", "application", "submitted"],
  under_review: ["processing", "underwriting", "conditional_approval", "suspended"],
  approved: ["approved", "clear_to_close", "docs_out", "funding", "closed"],
  rejected: ["denied", "withdrawn"],
} as const;

export type CopilotStatusGroup = keyof typeof COPILOT_STATUS_GROUPS;

export const COPILOT_STATUS_GROUP_LABELS: Record<CopilotStatusGroup, string> = {
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

export function getCopilotStatusGroup(status: string): CopilotStatusGroup | null {
  for (const [group, statuses] of Object.entries(COPILOT_STATUS_GROUPS)) {
    if ((statuses as readonly string[]).includes(status)) {
      return group as CopilotStatusGroup;
    }
  }
  return null;
}

export function formatRiskLevel(level: string): string {
  const n = level.toLowerCase();
  if (n === "high") return "High";
  if (n === "medium") return "Medium";
  if (n === "low") return "Low";
  return level;
}
