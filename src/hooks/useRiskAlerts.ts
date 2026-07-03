import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, invalidateKeys } from "@/lib/cache";

export interface RiskAlert {
  id: string;
  loan_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  dismissed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  loan?: { loan_number: string };
}

export function useRiskAlerts(filter?: "all" | "unread") {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.riskAlerts.all, filter],
    queryFn: async (): Promise<RiskAlert[]> => {
      let query = (supabase as any)
        .from("loan_risk_alerts")
        .select("*, loan:loans(loan_number)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (filter === "unread") {
        query = query.eq("is_read", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RiskAlert[];
    },
    enabled: !!user,
  });
}

export function useRiskAlertsByLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.riskAlerts.byLoan(loanId ?? ""),
    queryFn: async (): Promise<RiskAlert[]> => {
      if (!loanId) return [];
      const { data, error } = await (supabase as any)
        .from("loan_risk_alerts")
        .select("*")
        .eq("loan_id", loanId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as RiskAlert[];
    },
    enabled: !!loanId,
  });
}

export function useUnreadRiskAlertCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.riskAlerts.unread,
    queryFn: async (): Promise<number> => {
      const { count, error } = await (supabase as any)
        .from("loan_risk_alerts")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });
}

export function useDismissRiskAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await (supabase as any)
        .from("loan_risk_alerts")
        .update({ is_read: true, dismissed_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.riskAlerts(queryClient);
    },
  });
}

export function useDismissAllRiskAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("loan_risk_alerts")
        .update({ is_read: true, dismissed_at: new Date().toISOString() })
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.riskAlerts(queryClient);
    },
  });
}
