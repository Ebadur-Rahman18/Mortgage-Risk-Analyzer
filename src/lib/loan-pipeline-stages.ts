/** All valid loan statuses (DB `loans.status` values). */
export const ALL_LOAN_STATUSES = [
  "draft",
  "application",
  "submitted",
  "processing",
  "underwriting",
  "conditional_approval",
  "clear_to_close",
  "approved",
  "docs_out",
  "funding",
  "closed",
  "denied",
  "withdrawn",
  "suspended",
] as const;

export type LoanStatus = (typeof ALL_LOAN_STATUSES)[number];

/** Pipeline board columns — groups related statuses into visual columns. */
export const PIPELINE_STAGE_IDS = [
  "draft",
  "application",
  "processing",
  "underwriting",
  "approved",
  "closing",
  "closed",
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];

export const OTHER_COLUMN_ID = "other" as const;

export interface PipelineStageDef {
  id: PipelineStageId;
  label: string;
  /** Loan statuses that map into this board column. */
  statuses: readonly LoanStatus[];
}

export const PIPELINE_STAGES: PipelineStageDef[] = [
  { id: "draft", label: "Draft", statuses: ["draft"] },
  { id: "application", label: "Application", statuses: ["application", "submitted"] },
  { id: "processing", label: "Processing", statuses: ["processing"] },
  { id: "underwriting", label: "Underwriting", statuses: ["underwriting", "conditional_approval", "suspended"] },
  { id: "approved", label: "Approved", statuses: ["approved", "clear_to_close"] },
  { id: "closing", label: "Closing", statuses: ["docs_out", "funding"] },
  { id: "closed", label: "Closed", statuses: ["closed"] },
];

/** Flat status → display label map */
export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  application: "Application",
  submitted: "Submitted",
  processing: "Processing",
  underwriting: "Underwriting",
  conditional_approval: "Conditional Approval",
  clear_to_close: "Clear to Close",
  approved: "Approved",
  docs_out: "Docs Out",
  funding: "Funding",
  closed: "Closed",
  denied: "Denied",
  withdrawn: "Withdrawn",
  suspended: "Suspended",
};

const STATUS_TO_COLUMN = new Map<string, PipelineStageId>();
for (const stage of PIPELINE_STAGES) {
  for (const s of stage.statuses) {
    STATUS_TO_COLUMN.set(s, stage.id);
  }
}

const CANONICAL = new Set<string>(ALL_LOAN_STATUSES as unknown as string[]);

/** Options for SearchableSelect / filters: value + label */
export const PIPELINE_STAGE_SELECT_OPTIONS = ALL_LOAN_STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABELS[s] ?? s,
}));

export function isCanonicalStatus(status: string): boolean {
  return CANONICAL.has(status);
}

/** Column id for board grouping: canonical stage id or `other`. */
export function getColumnIdForLoanStatus(status: string): PipelineStageId | typeof OTHER_COLUMN_ID {
  return STATUS_TO_COLUMN.get(status) ?? OTHER_COLUMN_ID;
}

/** Whether this loan's status should be treated as managed outside manual entry (no drag). */
export function isLoanStatusExternallyManaged(dataSource: string | null, externalId: string | null): boolean {
  if (externalId && externalId.trim() !== "") return true;
  if (dataSource && dataSource !== "manual") return true;
  return false;
}

/** Terminal statuses — no further transitions allowed from these. */
export function isTerminalStatus(status: string): boolean {
  return status === "closed" || status === "denied" || status === "withdrawn";
}

/**
 * Returns the "entry" loan status when a loan is dragged into a pipeline column.
 * Each column maps to the first (primary) status in its statuses array.
 */
const COLUMN_ENTRY_STATUS = new Map<PipelineStageId, LoanStatus>();
for (const stage of PIPELINE_STAGES) {
  COLUMN_ENTRY_STATUS.set(stage.id, stage.statuses[0]);
}

export function getEntryStatusForColumn(columnId: PipelineStageId): LoanStatus | null {
  return COLUMN_ENTRY_STATUS.get(columnId) ?? null;
}
