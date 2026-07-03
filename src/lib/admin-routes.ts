import { permissionKey } from "./permissions";

/**
 * Map admin path to the permission required to access it.
 * Used for sidebar visibility and route-level enforcement.
 * Default for unmapped paths: admin:access (only role-based admin/moderator).
 */
export const ADMIN_PATH_PERMISSION: Record<string, string> = {
  "/admin": permissionKey("admin", "access"),
  "/admin/users": permissionKey("users", "read"),
  "/admin/roles": permissionKey("admin", "access"),
  "/admin/logs": permissionKey("admin", "access"),
  "/admin/feedback": permissionKey("admin", "access"),
  "/admin/ai-models": permissionKey("admin", "access"),
  "/admin/ai/llm-config": permissionKey("admin", "access"),
  "/admin/ai-usage": permissionKey("admin", "access"),
  "/admin/agents": permissionKey("admin", "access"),
  "/admin/settings": permissionKey("settings", "manage"),
  "/admin/integrations": permissionKey("settings", "manage"),
  "/admin/deployment": permissionKey("admin", "access"),
  "/admin/environment": permissionKey("admin", "access"),
  "/admin/onboarding": permissionKey("admin", "access"),
  "/admin/checklist": permissionKey("admin", "access"),
  "/admin/sso-settings": permissionKey("settings", "manage"),
  "/admin/meeting-analytics": permissionKey("admin", "access"),
  "/admin/knowledge-categories": permissionKey("knowledge", "read"),
  "/admin/knowledge-analytics": permissionKey("knowledge", "read"),
  "/admin/knowledge-documents": permissionKey("knowledge", "read"),
  "/admin/loan-products": permissionKey("loan_products", "read"),
  "/admin/modules": permissionKey("admin", "access"),
  "/admin/data-feeds": permissionKey("settings", "manage"),
  "/admin/sla": permissionKey("admin", "access"),
  "/admin/cronjobs": permissionKey("admin", "access"),
  "/admin/cronjob-logs": permissionKey("admin", "access"),
  "/admin/compliance-rules": permissionKey("admin", "access"),
  "/admin/hmda-reporting": permissionKey("admin", "access"),
  "/admin/licensing-tracker": permissionKey("admin", "access"),
};

/** Get required permission for a path (exact or longest prefix match). */
export function getPermissionForPath(pathname: string): string {
  if (ADMIN_PATH_PERMISSION[pathname]) return ADMIN_PATH_PERMISSION[pathname];
  const segments = pathname.split("/").filter(Boolean);
  while (segments.length > 0) {
    const path = "/" + segments.join("/");
    if (ADMIN_PATH_PERMISSION[path]) return ADMIN_PATH_PERMISSION[path];
    segments.pop();
  }
  return permissionKey("admin", "access");
}
