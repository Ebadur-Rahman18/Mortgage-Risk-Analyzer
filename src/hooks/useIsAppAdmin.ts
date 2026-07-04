import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

/**
 * Reliable admin check:
 * 1) profile.role from AuthContext
 * 2) user_roles rows for current user
 * 3) has_role() RPC (SECURITY DEFINER)
 */
export function useIsAppAdmin() {
  const { user, profile, profileLoading } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["is-app-admin", userId],
    queryFn: async (): Promise<boolean> => {
      if (!userId) return false;

      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!rolesError && (roleRows ?? []).some((r) => r.role === "admin")) {
        return true;
      }

      const { data: rpcResult, error: rpcError } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (!rpcError && rpcResult === true) {
        return true;
      }

      if (rolesError) {
        console.error("user_roles admin check failed:", rolesError);
      }
      if (rpcError) {
        console.error("has_role RPC admin check failed:", rpcError);
      }

      return false;
    },
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });

  const isAdmin =
    profile?.role === "admin" || query.data === true;

  return {
    isAdmin,
    isLoading: !!userId && (profileLoading || query.isLoading),
    error: query.error,
    userEmail: user?.email ?? null,
    profileRole: profile?.role ?? null,
  };
}
