import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, invalidateKeys } from "@/lib/cache";

export interface LockAlert {
  id: string;
  rate_lock_id: string;
  loan_id: string;
  alert_type: string;
  alert_date: string;
  title: string;
  message: string;
  is_read: boolean;
  dismissed_at: string | null;
  sent: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useLockAlertsByLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pricing.lockAlerts.byLoan(loanId ?? ""),
    queryFn: async (): Promise<LockAlert[]> => {
      if (!loanId) return [];
      const { data, error } = await (supabase as any)
        .from("lock_alerts")
        .select("*")
        .eq("loan_id", loanId)
        .eq("is_read", false)
        .order("alert_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LockAlert[];
    },
    enabled: !!loanId,
  });
}

export function useUnreadLockAlertCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.pricing.lockAlerts.all,
    queryFn: async (): Promise<number> => {
      const { count, error } = await (supabase as any)
        .from("lock_alerts")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });
}

export function useDismissLockAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await (supabase as any)
        .from("lock_alerts")
        .update({ is_read: true, dismissed_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.riskAlerts(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.pricing.lockAlerts.all });
    },
  });
}

