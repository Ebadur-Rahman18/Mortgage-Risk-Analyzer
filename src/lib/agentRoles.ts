/**
 * agentRoles.ts
 *
 * Single source of truth for:
 *   1. Role normalisation (profile.role + profile.customRoleName).
 *   2. Per-agent allowed-role allowlists (AGENT_ALLOWED_ROLES_BY_SLUG).
 *   3. Helper functions used by every UI gate and execution-path guard.
 *
 * Rules
 * -----
 * - Normalised roles are lowercase, trimmed, spaces/hyphens → underscores.
 * - Both the app role (profile.role) AND the custom role name
 *   (profile.customRoleName) are checked; either match grants access.
 * - Default behaviour is EXPLICIT deny — no silent admin-only fallback.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoleProfile {
  role?: string | null;
  customRoleName?: string | null;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Normalise a single role string:
 *   " Branch Manager " → "branch_manager"
 *   "loan-officer"     → "loan_officer"
 */
export function normalizeRoleString(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Return a Set of all normalised roles for the given profile.
 * Includes both the app role and the custom role name (if present).
 */
export function getNormalizedUserRoles(profile: RoleProfile | null | undefined): Set<string> {
  const roles = new Set<string>();
  const appRole = normalizeRoleString(profile?.role);
  const customRole = normalizeRoleString(profile?.customRoleName);
  if (appRole) roles.add(appRole);
  if (customRole) roles.add(customRole);
  return roles;
}

/**
 * Returns true if the user holds at least one of the allowedRoles.
 * Checks both profile.role and profile.customRoleName.
 */
export function hasAnyRole(
  profile: RoleProfile | null | undefined,
  allowedRoles: readonly string[],
): boolean {
  const userRoles = getNormalizedUserRoles(profile);
  return allowedRoles.some((r) => userRoles.has(normalizeRoleString(r)));
}

/** Roles that may open the Memory tab on agent chat (hidden for app role `user`). */
export const AGENT_MEMORY_PANEL_ROLES = [
  "admin",
  "moderator",
  "loan_officer",
  "branch_manager",
] as const;

export function canViewAgentMemoryPanel(profile: RoleProfile | null | undefined): boolean {
  return hasAnyRole(profile, AGENT_MEMORY_PANEL_ROLES);
}

/** Admins/moderators see all users' memories for an agent; others see only their own. */
export function canViewAllAgentMemories(profile: RoleProfile | null | undefined): boolean {
  return hasAnyRole(profile, ["admin", "moderator"]);
}

// ── Per-agent allowed-role allowlists ─────────────────────────────────────────
//
// Keys must match the slug stored in ai_agents.slug (and the constants in
// useAgentEnabled.ts).  The value is the array of normalised roles that may
// SEE the agent UI and EXECUTE the agent.
//
// Use `null` to mean "any authenticated user" (no role restriction beyond login).
//
// PRODUCT DECISIONS NEEDED (flagged below):
//   • portfolio-summary-agent  — currently visible to all via ManagerDashboard;
//     no explicit role gate. Set to ["admin","branch_manager","moderator"]
//     as a sensible default — adjust if product wants wider access.
//   • action-items-agent       — shown to all authenticated users in the sidebar;
//     set to null (all roles) to preserve current open behaviour.
//   • document-generation-agent — shown to all authenticated users via
//     CommunicationCenter; set to null unless product wants to restrict.

export const AGENT_ALLOWED_ROLES_BY_SLUG: Record<string, readonly string[] | null> = {
  /** Loan-level real-time AI coaching */
  "loan-coaching-agent": ["admin", "moderator", "loan_officer", "branch_manager"],

  /** Hybrid rule + AI underwriting scorecard */
  "underwriter-precheck-agent": ["admin", "moderator", "loan_officer", "branch_manager"],

  /** Urgency-ranked loan queue */
  "pipeline-prioritization-agent": ["admin", "moderator", "loan_officer", "branch_manager"],

  /** File risk analysis panel */
  "file-risk-agent": ["admin", "moderator", "loan_officer", "branch_manager"],

  /**
   * Portfolio / pipeline summary narrative for managers.
   * PRODUCT NOTE: Only managers/admins have the ManagerDashboard context to
   * use this, so restrict accordingly.
   */
  "portfolio-summary-agent": ["admin", "moderator", "branch_manager"],

  /**
   * Daily action items generator.
   * PRODUCT NOTE: Currently shown to all users in sidebar / ActionItems page.
   * Keeping null (all roles) to preserve that behaviour.
   */
  "action-items-agent": null,

  /**
   * Borrower communication / document draft generator.
   * PRODUCT NOTE: CommunicationCenter is accessible by all authenticated users.
   * Keeping null unless product restricts.
   */
  "document-generation-agent": null,

  /** Rate Alert Intelligence Agent — monitors rate movements vs active locks. */
  "rate-alert-intelligence-agent": ["admin", "moderator", "loan_officer", "branch_manager"],

  /** Compliance Screening Agent — TRID, HMDA, Fair Lending checks (admin/manager oversight). */
  "compliance-screening-agent": ["admin", "moderator", "branch_manager"],

  /** Branch Performance Coach Agent — weekly coaching digest for managers. */
  "branch-performance-coach-agent": ["admin", "moderator", "branch_manager"],

  /** Manager Insight Agent — manager Q&A on workload, stale loans, and pipeline velocity. */
  "manager-insight-agent": ["admin", "moderator", "branch_manager"],

  /**
   * Email Intelligence — Gmail sync, extraction, loan linking, draft replies.
   * Same openness as document-generation (all authenticated users).
   */
  "email-intelligence-agent": null,
} as const;

/**
 * Returns true if the given user profile is allowed to use the named agent.
 *
 * - Known slugs use AGENT_ALLOWED_ROLES_BY_SLUG (code allowlist wins).
 * - Other slugs: pass `dbRequiredRole` from `ai_agents.required_role`. Use `undefined` when the slug
 *   is not tied to a DB row (unknown slugs are denied). Use `null` or `""` from the row for “any authenticated user”.
 */
export function isAgentAllowedForUser(
  agentSlug: string,
  profile: RoleProfile | null | undefined,
  dbRequiredRole?: string | null | undefined,
): boolean {
  if (Object.prototype.hasOwnProperty.call(AGENT_ALLOWED_ROLES_BY_SLUG, agentSlug)) {
    const allowedRoles = AGENT_ALLOWED_ROLES_BY_SLUG[agentSlug];
    if (allowedRoles === null) return true;
    return hasAnyRole(profile, allowedRoles);
  }

  if (dbRequiredRole === undefined) {
    return false;
  }

  const raw = (dbRequiredRole ?? "").trim();
  if (!raw) return true;

  const parts = raw.split(/[,;]+/).map((s) => normalizeRoleString(s)).filter(Boolean);
  if (parts.length === 0) return true;
  return hasAnyRole(profile, parts);
}
