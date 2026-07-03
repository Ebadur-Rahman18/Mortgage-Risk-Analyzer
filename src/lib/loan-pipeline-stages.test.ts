import { describe, it, expect } from "vitest";
import {
  getColumnIdForLoanStatus,
  isCanonicalStatus,
  isLoanStatusExternallyManaged,
  OTHER_COLUMN_ID,
} from "./loan-pipeline-stages";

describe("loan-pipeline-stages", () => {
  it("maps canonical statuses to their column id", () => {
    expect(getColumnIdForLoanStatus("draft")).toBe("draft");
    expect(getColumnIdForLoanStatus("closed")).toBe("closed");
  });

  it("maps unknown statuses to other", () => {
    expect(getColumnIdForLoanStatus("weird_status")).toBe(OTHER_COLUMN_ID);
    expect(getColumnIdForLoanStatus("")).toBe(OTHER_COLUMN_ID);
  });

  it("isCanonicalStatus", () => {
    expect(isCanonicalStatus("processing")).toBe(true);
    expect(isCanonicalStatus("weird")).toBe(false);
  });

  it("isLoanStatusExternallyManaged", () => {
    expect(isLoanStatusExternallyManaged("manual", null)).toBe(false);
    expect(isLoanStatusExternallyManaged(null, null)).toBe(false);
    expect(isLoanStatusExternallyManaged("lendingpad", null)).toBe(true);
    expect(isLoanStatusExternallyManaged("manual", "ext-1")).toBe(true);
  });
});
