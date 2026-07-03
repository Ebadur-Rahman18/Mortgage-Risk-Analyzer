import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export type ManagementScope = "org" | "branch" | "personal" | "none";

interface ScopeResult {
  scope: ManagementScope;
  appRole: string | null;
  customRoleSlug: string | null;
  /** True when user should see Manager dashboard in navigation (admin + branch manager). */
  showInNav: boolean;
}

function normalizeRoleSlug(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function useManagementScope(): ScopeResult {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const appRole = profile?.role ?? null;

  const { data: roleRow } = useQuery({
    queryKey: ["user_roles", "management-scope", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, custom_role_id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as { role: string | null; custom_role_id: string | null } | null;
    },
    enabled: !!userId,
  });

  const customRoleId = roleRow?.custom_role_id ?? null;

  const { data: customRole } = useQuery({
    queryKey: ["roles", "slug", customRoleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("slug")
        .eq("id", customRoleId!)
        .maybeSingle();
      if (error) throw error;
      return data as { slug: string } | null;
    },
    enabled: !!customRoleId,
  });

  const customRoleSlug = customRole?.slug ?? null;
  const normalizedCustomRoleSlug = normalizeRoleSlug(customRoleSlug);
  const normalizedProfileCustomRole = normalizeRoleSlug(profile?.customRoleName ?? null);
  const isBranchManagerRole =
    normalizedCustomRoleSlug === "branch_manager" ||
    normalizedProfileCustomRole === "branch_manager";

  let scope: ManagementScope = "none";

  if (appRole === "admin" || appRole === "moderator") {
    scope = "org";
  } else if (isBranchManagerRole) {
    scope = "branch";
  } else if (appRole === "user") {
    // Loan officers and standard users both get a personal view based on current RLS.
    scope = "personal";
  } else {
    scope = "none";
  }

  const showInNav = scope !== "none";

  return {
    scope,
    appRole,
    customRoleSlug,
    showInNav,
  };
}

