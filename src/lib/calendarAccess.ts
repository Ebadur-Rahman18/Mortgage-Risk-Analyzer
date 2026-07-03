import type { RoleProfile } from "@/lib/agentRoles";
import { hasAnyRole } from "@/lib/agentRoles";

/** Roles allowed to see the Operations calendar (LO, branch manager, admin). */
export const OPERATIONS_CALENDAR_ROLES = ["admin", "loan_officer", "branch_manager"] as const;

export function canAccessOperationsCalendar(profile: RoleProfile | null | undefined): boolean {
  return hasAnyRole(profile, OPERATIONS_CALENDAR_ROLES);
}
