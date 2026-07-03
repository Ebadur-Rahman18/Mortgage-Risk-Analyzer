import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPermissionSettings } from "@/hooks/useUserPermissionSettings";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { supabase } from "@/lib/supabase";
import { AVAILABLE_PERMISSIONS, permissionKey, LITE_ROLE_PERMISSIONS, isLiteRole } from "@/lib/permissions";

/**
 * Effective permissions for the current user:
 * - If user has app role "admin", they have all permissions.
 * - Else if user has a custom role (user_roles.custom_role_id), use that role's permissions from roles table.
 * - Otherwise use user_permission_settings (per-user toggles).
 */
export function useEffectivePermissions() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin, isLoading: adminLoading } = useIsAppAdmin();
  const { data: settings, isLoading: settingsLoading } = useUserPermissionSettings(userId);

  const { data: userRoleRows } = useQuery({
    queryKey: ["user_roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, custom_role_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as { role: string; custom_role_id: string | null }[];
    },
    enabled: !!userId,
  });

  const customRoleId =
    (userRoleRows ?? []).find((r) => r.role === (isAdmin ? "admin" : profile?.role))
      ?.custom_role_id ??
    userRoleRows?.[0]?.custom_role_id ??
    null;

  const { data: rolePermissions, isLoading: roleLoading } = useQuery({
    queryKey: ["roles", "permissions", customRoleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("permissions")
        .eq("id", customRoleId!)
        .single();
      if (error) throw error;
      return (data?.permissions ?? []) as string[];
    },
    enabled: !!customRoleId && !isAdmin,
  });

  const permissions: string[] = useMemo(() => {
    if (!userId) return [];
    if (isAdmin) {
      return AVAILABLE_PERMISSIONS.map((p) => permissionKey(p.resource, p.action));
    }
    if (Array.isArray(rolePermissions) && rolePermissions.length > 0) {
      return rolePermissions;
    }
    if (Array.isArray(settings?.permissions) && settings.permissions.length > 0) {
      return settings.permissions;
    }
    // MCT Lite fallback: derive default permissions from the system role.
    if (isLiteRole(profile?.role)) {
      return LITE_ROLE_PERMISSIONS[profile.role as "loan_officer" | "user" | "admin"];
    }
    return [];
  }, [userId, isAdmin, rolePermissions, settings?.permissions, profile?.role]);

  const hasPermission = useMemo(
    () =>
      (key: string): boolean => {
        if (!userId) return false;
        if (isAdmin) return true;
        return permissions.includes(key);
      },
    [userId, isAdmin, permissions]
  );

  const hasAnyPermission = useMemo(
    () =>
      (keys: string[]): boolean => {
        return keys.some((k) => hasPermission(k));
      },
    [hasPermission]
  );

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    isAdmin,
    isLoading:
      !!userId &&
      (adminLoading || (!isAdmin && (settingsLoading || (!!customRoleId && roleLoading)))),
  };
}
