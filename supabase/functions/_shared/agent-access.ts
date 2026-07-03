/**
 * Server-side agent access rules (keep in sync with src/lib/agentRoles.ts).
 * Used by run-ai-agent to enforce the same visibility as AgentsBrowse.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type RoleProfile = {
  role?: string | null;
  customRoleName?: string | null;
};

function normalizeRoleString(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getNormalizedUserRoles(profile: RoleProfile | null | undefined): Set<string> {
  const roles = new Set<string>();
  const appRole = normalizeRoleString(profile?.role);
  const customRole = normalizeRoleString(profile?.customRoleName);
  if (appRole) roles.add(appRole);
  if (customRole) roles.add(customRole);
  return roles;
}

function hasAnyRole(
  profile: RoleProfile | null | undefined,
  allowedRoles: readonly string[],
): boolean {
  const userRoles = getNormalizedUserRoles(profile);
  return allowedRoles.some((r) => userRoles.has(normalizeRoleString(r)));
}

/** Duplicate of AGENT_ALLOWED_ROLES_BY_SLUG — update both when product changes. */
const AGENT_ALLOWED_ROLES_BY_SLUG: Record<string, readonly string[] | null> = {
  "loan-coaching-agent": ["admin", "moderator", "loan_officer", "branch_manager"],
  "underwriter-precheck-agent": ["admin", "moderator", "loan_officer", "branch_manager"],
  "pipeline-prioritization-agent": ["admin", "moderator", "loan_officer", "branch_manager"],
  "file-risk-agent": ["admin", "moderator", "loan_officer", "branch_manager"],
  "portfolio-summary-agent": ["admin", "moderator", "branch_manager"],
  "action-items-agent": null,
  "document-generation-agent": null,
  "rate-alert-intelligence-agent": ["admin", "moderator", "loan_officer", "branch_manager"],
  "compliance-screening-agent": ["admin", "moderator", "branch_manager"],
  "branch-performance-coach-agent": ["admin", "moderator", "branch_manager"],
  "manager-insight-agent": ["admin", "moderator", "branch_manager"],
  "email-intelligence-agent": null,
};

/**
 * Same as src/lib/agentRoles isAgentAllowedForUser; dbRequiredRole is always set from ai_agents row.
 */
export function isAgentAllowedForUserEdge(
  agentSlug: string,
  profile: RoleProfile | null | undefined,
  dbRequiredRole: string | null,
): boolean {
  if (Object.prototype.hasOwnProperty.call(AGENT_ALLOWED_ROLES_BY_SLUG, agentSlug)) {
    const allowedRoles = AGENT_ALLOWED_ROLES_BY_SLUG[agentSlug];
    if (allowedRoles === null) return true;
    return hasAnyRole(profile, allowedRoles);
  }

  const raw = (dbRequiredRole ?? "").trim();
  if (!raw) return true;

  const parts = raw.split(/[,;]+/).map((s) => normalizeRoleString(s)).filter(Boolean);
  if (parts.length === 0) return true;
  return hasAnyRole(profile, parts);
}

export async function loadRoleProfileForEdge(
  service: SupabaseClient,
  userId: string,
): Promise<RoleProfile> {
  const { data: ur } = await service
    .from('user_roles')
    .select('role, custom_role_id')
    .eq('user_id', userId)
    .maybeSingle();

  let customRoleName: string | null = null;
  if (ur?.custom_role_id) {
    const { data: cr } = await service.from('roles').select('name').eq('id', ur.custom_role_id).maybeSingle();
    customRoleName = cr?.name ?? null;
  }

  return {
    role: ur?.role ?? 'user',
    customRoleName,
  };
}
