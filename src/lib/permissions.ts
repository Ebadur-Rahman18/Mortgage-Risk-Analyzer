/**
 * Shared permission definitions for roles and user permission settings.
 * Used by RoleManagement (edit role) and UserManagement (edit user permissions).
 */

export interface PermissionDef {
  resource: string;
  action: string;
  label: string;
}

/** Permission key format: "resource:action" e.g. "users:read" */
export function permissionKey(resource: string, action: string): string {
  return `${resource}:${action}`;
}

export const AVAILABLE_PERMISSIONS: PermissionDef[] = [
  { resource: "users", action: "read", label: "View Users" },
  { resource: "users", action: "create", label: "Create Users" },
  { resource: "users", action: "update", label: "Update Users" },
  { resource: "users", action: "delete", label: "Delete Users" },
  { resource: "clients", action: "read", label: "View Clients" },
  { resource: "clients", action: "create", label: "Create Clients" },
  { resource: "clients", action: "update", label: "Update Clients" },
  { resource: "clients", action: "delete", label: "Delete Clients" },
  { resource: "meetings", action: "read", label: "View Meetings" },
  { resource: "meetings", action: "create", label: "Create Meetings" },
  { resource: "meetings", action: "update", label: "Update Meetings" },
  { resource: "meetings", action: "delete", label: "Delete Meetings" },
  { resource: "tasks", action: "read", label: "View Tasks" },
  { resource: "tasks", action: "create", label: "Create Tasks" },
  { resource: "tasks", action: "update", label: "Update Tasks" },
  { resource: "tasks", action: "delete", label: "Delete Tasks" },
  { resource: "tasks", action: "assign", label: "Assign Tasks to Others" },
  { resource: "knowledge", action: "read", label: "View Knowledge Base" },
  { resource: "knowledge", action: "create", label: "Create Knowledge" },
  { resource: "knowledge", action: "update", label: "Update Knowledge" },
  { resource: "knowledge", action: "delete", label: "Delete Knowledge" },
  { resource: "ai_chat", action: "read", label: "View AI Chat in Sidebar" },
  { resource: "loan_products", action: "read", label: "View Loan Products" },
  { resource: "loan_products", action: "create", label: "Create Loan Products" },
  { resource: "loan_products", action: "update", label: "Update Loan Products" },
  { resource: "loan_products", action: "delete", label: "Delete Loan Products" },
  { resource: "loan_programs", action: "read", label: "View Loan Programs" },
  { resource: "loan_programs", action: "create", label: "Create Loan Programs" },
  { resource: "loan_programs", action: "update", label: "Update Loan Programs" },
  { resource: "loan_programs", action: "delete", label: "Delete Loan Programs" },
  { resource: "loans", action: "read", label: "View Loans" },
  { resource: "loans", action: "create", label: "Create Loans" },
  { resource: "loans", action: "update", label: "Update Loans" },
  { resource: "loans", action: "delete", label: "Delete Loans" },
  { resource: "loans", action: "export", label: "Export Pipeline (CSV/Excel)" },
  { resource: "loans", action: "import", label: "Import Loans (CSV)" },
  { resource: "loan_risk_analyses", action: "read", label: "View Risk Copilot Analyses" },
  { resource: "loan_risk_analyses", action: "run", label: "Run Risk Copilot Analysis" },
  { resource: "loan_risk_chat", action: "use", label: "Use Risk Copilot Chat" },
  { resource: "borrowers", action: "read", label: "View Borrowers" },
  { resource: "borrowers", action: "create", label: "Create Borrowers" },
  { resource: "borrowers", action: "update", label: "Update Borrowers" },
  { resource: "borrowers", action: "delete", label: "Delete Borrowers" },
  { resource: "admin", action: "access", label: "Access Admin Panel" },
  { resource: "settings", action: "manage", label: "Manage System Settings" },
  // Pricing & Rate Lock
  { resource: "pricing", action: "read", label: "View Pricing & Rate Lock module" },
  { resource: "pricing", action: "calculate", label: "Use Pricing Calculator" },
  { resource: "rate_sheets", action: "manage", label: "Manage Rate Sheets & Datastores" },
  { resource: "pricing_eligibility", action: "manage", label: "Manage Product Eligibility Rules" },
  { resource: "rate_locks", action: "read", label: "View Rate Locks" },
  { resource: "rate_locks", action: "manage", label: "Create/Extend/Relock Rate Locks" },
  { resource: "compliance", action: "run", label: "Run deterministic compliance rules" },
  { resource: "aus", action: "submit", label: "Submit AUS (DU / LPA) requests" },
];

export function groupPermissionsByResource(): Record<string, PermissionDef[]> {
  const grouped: Record<string, PermissionDef[]> = {};
  AVAILABLE_PERMISSIONS.forEach((perm) => {
    if (!grouped[perm.resource]) grouped[perm.resource] = [];
    grouped[perm.resource].push(perm);
  });
  return grouped;
}

/**
 * MCT Lite: the three system roles and their default permission sets.
 *
 * - admin   : every permission (handled separately in useEffectivePermissions).
 * - loan_officer : pipeline operator — own loans, borrowers, knowledge, AI chat, action items.
 * - user    : support/processor — assigned tasks, action items, knowledge, AI chat (no pipeline).
 *
 * These act as the fallback when a user has no custom_role_id and no per-user
 * permission settings (typical for fresh signups).
 */
export type LiteRole = "admin" | "loan_officer" | "user";

export const LITE_ROLE_PERMISSIONS: Record<LiteRole, string[]> = {
  admin: AVAILABLE_PERMISSIONS.map((p) => permissionKey(p.resource, p.action)),
  loan_officer: [
    permissionKey("loans", "read"),
    permissionKey("loans", "create"),
    permissionKey("loans", "update"),
    permissionKey("loans", "export"),
    permissionKey("borrowers", "read"),
    permissionKey("borrowers", "create"),
    permissionKey("borrowers", "update"),
    permissionKey("knowledge", "read"),
    permissionKey("ai_chat", "read"),
    permissionKey("tasks", "read"),
    permissionKey("tasks", "create"),
    permissionKey("tasks", "update"),
  ],
  user: [
    permissionKey("tasks", "read"),
    permissionKey("tasks", "update"),
    permissionKey("knowledge", "read"),
    permissionKey("ai_chat", "read"),
  ],
};

export function isLiteRole(role: string | null | undefined): role is LiteRole {
  return role === "admin" || role === "loan_officer" || role === "user";
}

