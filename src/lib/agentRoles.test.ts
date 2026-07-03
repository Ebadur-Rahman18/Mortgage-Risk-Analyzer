import { describe, it, expect } from "vitest";
import {
  normalizeRoleString,
  getNormalizedUserRoles,
  hasAnyRole,
  isAgentAllowedForUser,
  canViewAgentMemoryPanel,
  canViewAllAgentMemories,
  AGENT_ALLOWED_ROLES_BY_SLUG,
} from "./agentRoles";

// ── normalizeRoleString ────────────────────────────────────────────────────────

describe("normalizeRoleString", () => {
  it("lowercases and trims", () => {
    expect(normalizeRoleString("  Admin  ")).toBe("admin");
  });

  it("replaces spaces with underscores", () => {
    expect(normalizeRoleString("Loan Officer")).toBe("loan_officer");
  });

  it("replaces hyphens with underscores", () => {
    expect(normalizeRoleString("branch-manager")).toBe("branch_manager");
  });

  it("handles mixed case + spaces + hyphens", () => {
    expect(normalizeRoleString("Branch Manager")).toBe("branch_manager");
    expect(normalizeRoleString("LOAN-OFFICER")).toBe("loan_officer");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(normalizeRoleString(null)).toBe("");
    expect(normalizeRoleString(undefined)).toBe("");
    expect(normalizeRoleString("")).toBe("");
    expect(normalizeRoleString("   ")).toBe("");
  });
});

// ── getNormalizedUserRoles ─────────────────────────────────────────────────────

describe("getNormalizedUserRoles", () => {
  it("returns empty set for null profile", () => {
    expect(getNormalizedUserRoles(null).size).toBe(0);
    expect(getNormalizedUserRoles(undefined).size).toBe(0);
  });

  it("includes only app role when no customRoleName", () => {
    const roles = getNormalizedUserRoles({ role: "admin" });
    expect(roles.has("admin")).toBe(true);
    expect(roles.size).toBe(1);
  });

  it("includes both app role and normalised custom role name", () => {
    const roles = getNormalizedUserRoles({
      role: "user",
      customRoleName: "Loan Officer",
    });
    expect(roles.has("user")).toBe(true);
    expect(roles.has("loan_officer")).toBe(true);
    expect(roles.size).toBe(2);
  });

  it("normalises custom role names with hyphens and mixed case", () => {
    const roles = getNormalizedUserRoles({ role: "user", customRoleName: "Branch-Manager" });
    expect(roles.has("branch_manager")).toBe(true);
  });

  it("omits empty strings from the set", () => {
    const roles = getNormalizedUserRoles({ role: "", customRoleName: "" });
    expect(roles.size).toBe(0);
  });
});

// ── hasAnyRole ─────────────────────────────────────────────────────────────────

describe("hasAnyRole", () => {
  const ALLOWED = ["admin", "loan_officer", "branch_manager"];

  it("grants access when app role matches", () => {
    expect(hasAnyRole({ role: "admin" }, ALLOWED)).toBe(true);
    expect(hasAnyRole({ role: "loan_officer" }, ALLOWED)).toBe(true);
  });

  it("grants access when custom role name matches after normalisation", () => {
    expect(hasAnyRole({ role: "user", customRoleName: "Loan Officer" }, ALLOWED)).toBe(true);
    expect(hasAnyRole({ role: "user", customRoleName: "Branch Manager" }, ALLOWED)).toBe(true);
    expect(hasAnyRole({ role: "user", customRoleName: "branch-manager" }, ALLOWED)).toBe(true);
  });

  it("denies access when neither role is in allowlist", () => {
    expect(hasAnyRole({ role: "user" }, ALLOWED)).toBe(false);
    expect(hasAnyRole({ role: "user", customRoleName: "Support" }, ALLOWED)).toBe(false);
  });

  it("denies access for null / undefined profile", () => {
    expect(hasAnyRole(null, ALLOWED)).toBe(false);
    expect(hasAnyRole(undefined, ALLOWED)).toBe(false);
  });

  it("denies access for empty allowlist", () => {
    expect(hasAnyRole({ role: "admin" }, [])).toBe(false);
  });

  it("also normalises the allowedRoles entries", () => {
    // Allowlist written with spaces/mixed case should still match
    expect(hasAnyRole({ role: "loan_officer" }, ["Loan Officer"])).toBe(true);
  });
});

describe("agent memory panel roles", () => {
  it("hides memory panel for app role user", () => {
    expect(canViewAgentMemoryPanel({ role: "user" })).toBe(false);
  });

  it("shows memory panel for loan_officer and admin", () => {
    expect(canViewAgentMemoryPanel({ role: "loan_officer" })).toBe(true);
    expect(canViewAgentMemoryPanel({ role: "admin" })).toBe(true);
    expect(canViewAgentMemoryPanel({ role: "branch_manager" })).toBe(true);
  });

  it("allows all-memories scope only for admin and moderator", () => {
    expect(canViewAllAgentMemories({ role: "admin" })).toBe(true);
    expect(canViewAllAgentMemories({ role: "moderator" })).toBe(true);
    expect(canViewAllAgentMemories({ role: "loan_officer" })).toBe(false);
  });
});

// ── isAgentAllowedForUser ──────────────────────────────────────────────────────

describe("isAgentAllowedForUser", () => {
  // loan-coaching-agent: restricted to coaching roles
  describe("loan-coaching-agent", () => {
    const slug = "loan-coaching-agent";

    it("allows admin", () => {
      expect(isAgentAllowedForUser(slug, { role: "admin" })).toBe(true);
    });

    it("allows loan_officer via app role", () => {
      expect(isAgentAllowedForUser(slug, { role: "loan_officer" })).toBe(true);
    });

    it("allows branch_manager via custom role name", () => {
      expect(isAgentAllowedForUser(slug, { role: "user", customRoleName: "Branch Manager" })).toBe(true);
    });

    it("denies plain user role", () => {
      expect(isAgentAllowedForUser(slug, { role: "user" })).toBe(false);
    });

    it("denies null profile", () => {
      expect(isAgentAllowedForUser(slug, null)).toBe(false);
    });
  });

  // pipeline-prioritization-agent: same restricted set
  describe("pipeline-prioritization-agent", () => {
    const slug = "pipeline-prioritization-agent";

    it("allows branch_manager via app role", () => {
      expect(isAgentAllowedForUser(slug, { role: "branch_manager" })).toBe(true);
    });

    it("allows loan_officer via custom role name (mixed case)", () => {
      expect(isAgentAllowedForUser(slug, { role: "user", customRoleName: "Loan Officer" })).toBe(true);
    });

    it("denies user role without custom override", () => {
      expect(isAgentAllowedForUser(slug, { role: "user" })).toBe(false);
    });
  });

  // action-items-agent: null allowlist → all authenticated users
  describe("action-items-agent", () => {
    const slug = "action-items-agent";

    it("allows any authenticated user (null allowlist)", () => {
      expect(isAgentAllowedForUser(slug, { role: "user" })).toBe(true);
      expect(isAgentAllowedForUser(slug, { role: "admin" })).toBe(true);
    });

    it("still allows null profile (null allowlist means no role restriction)", () => {
      expect(isAgentAllowedForUser(slug, null)).toBe(true);
    });
  });

  // document-generation-agent: null allowlist
  describe("document-generation-agent", () => {
    it("allows any role", () => {
      expect(isAgentAllowedForUser("document-generation-agent", { role: "user" })).toBe(true);
    });
  });

  // portfolio-summary-agent: restricted to managers
  describe("portfolio-summary-agent", () => {
    const slug = "portfolio-summary-agent";

    it("allows admin and branch_manager", () => {
      expect(isAgentAllowedForUser(slug, { role: "admin" })).toBe(true);
      expect(isAgentAllowedForUser(slug, { role: "branch_manager" })).toBe(true);
    });

    it("denies loan_officer", () => {
      expect(isAgentAllowedForUser(slug, { role: "loan_officer" })).toBe(false);
    });
  });

  // Unknown slug: deny when no DB policy passed; open when DB says so
  describe("unknown slug", () => {
    it("denies access when dbRequiredRole is omitted", () => {
      expect(isAgentAllowedForUser("some-unknown-agent", { role: "admin" })).toBe(false);
      expect(isAgentAllowedForUser("", { role: "admin" })).toBe(false);
    });

    it("allows any authenticated user when DB policy is empty (null)", () => {
      expect(isAgentAllowedForUser("custom-sales-agent", { role: "user" }, null)).toBe(true);
    });

    it("restricts to listed roles when DB policy is set", () => {
      expect(isAgentAllowedForUser("custom-sales-agent", { role: "user", customRoleName: "Loan Officer" }, "loan_officer")).toBe(true);
      expect(isAgentAllowedForUser("custom-sales-agent", { role: "user" }, "loan_officer")).toBe(false);
    });
  });

  // All known slugs are registered
  describe("AGENT_ALLOWED_ROLES_BY_SLUG completeness", () => {
    it("contains all expected agent slugs", () => {
      const expected = [
        "loan-coaching-agent",
        "underwriter-precheck-agent",
        "pipeline-prioritization-agent",
        "file-risk-agent",
        "portfolio-summary-agent",
        "action-items-agent",
        "document-generation-agent",
      ];
      for (const slug of expected) {
        expect(Object.prototype.hasOwnProperty.call(AGENT_ALLOWED_ROLES_BY_SLUG, slug)).toBe(true);
      }
    });
  });
});
