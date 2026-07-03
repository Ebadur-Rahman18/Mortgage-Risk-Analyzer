import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface AdminStats {
  totalUsers: number;
  activeSessions: number;
  databaseSize: string;
  edgeFunctionsCount: number;
  newUsersThisMonth: number;
  databaseGrowth: string;
}

interface AdminStatsRpcResult {
  total_users: number;
  active_sessions: number;
  database_size: string;
  new_users_month: number;
}

async function fetchAdminStats(): Promise<AdminStats> {
  try {
    const { data: sqlStats, error: sqlError } = await supabase
      .rpc("get_admin_stats");

    if (!sqlError && sqlStats) {
      const stats = sqlStats as unknown as AdminStatsRpcResult;

      const { count: edgeFunctionsCount } = await supabase
        .from("edge_functions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      return {
        totalUsers: stats.total_users ?? 0,
        activeSessions: stats.active_sessions ?? 0,
        databaseSize: stats.database_size ?? "0 MB",
        edgeFunctionsCount: edgeFunctionsCount ?? 0,
        newUsersThisMonth: stats.new_users_month ?? 0,
        databaseGrowth: "",
      };
    }

    // Fallback to manual queries
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const { count: newUsersThisMonth } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", firstDayOfMonth.toISOString());

    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const { count: activeSessions } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("updated_at", oneDayAgo.toISOString());

    const { count: edgeFunctionsCount } = await supabase
      .from("edge_functions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    return {
      totalUsers: totalUsers ?? 0,
      activeSessions: activeSessions ?? 0,
      databaseSize: "0 MB",
      edgeFunctionsCount: edgeFunctionsCount ?? 0,
      newUsersThisMonth: newUsersThisMonth ?? 0,
      databaseGrowth: "",
    };
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return {
      totalUsers: 0,
      activeSessions: 0,
      databaseSize: "0 MB",
      edgeFunctionsCount: 0,
      newUsersThisMonth: 0,
      databaseGrowth: "",
    };
  }
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
