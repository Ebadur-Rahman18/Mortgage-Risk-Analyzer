import { useQuery } from "@tanstack/react-query";
import { runClientHealthChecks, type ClientHealthChecks } from "@/lib/admin-health-checks";

export function useAdminSystemHealth() {
  return useQuery<ClientHealthChecks>({
    queryKey: ["admin-system-health"],
    queryFn: runClientHealthChecks,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
