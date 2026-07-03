import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface RateAlertAnalysis {
  id: string;
  loan_id: string;
  rate_lock_id: string;
  loan_officer_id: string | null;
  branch_id: string | null;
  alert_type: "at_risk" | "float_down" | "no_action";
  locked_rate: number | null;
  current_market_rate: number | null;
  rate_delta: number | null;
  days_remaining: number | null;
  ai_narrative: string | null;
  ai_recommendation: string | null;
  severity: string;
  metadata: Json;
  scored_at: string;
  loans?: {
    id: string;
    loan_number: string;
    loan_amount: number | null;
    loan_officer_id: string | null;
    borrowers?: { first_name?: string; last_name?: string } | null;
  } | null;
}

export interface RateAlertSummary {
  at_risk: number;
  float_down: number;
  total: number;
}

const alertKeys = {
  all: ["rate_alert_analyses"] as const,
  list: () => ["rate_alert_analyses", "list"] as const,
  byLoan: (loanId: string) => ["rate_alert_analyses", "loan", loanId] as const,
  summary: () => ["rate_alert_analyses", "summary"] as const,
};

export function useRateAlertAnalyses() {
  return useQuery({
    queryKey: alertKeys.list(),
    queryFn: async (): Promise<RateAlertAnalysis[]> => {
      const { data, error } = await supabase
        .from("rate_alert_analyses")
        .select(
          "*, loans(id, loan_number, loan_amount, loan_officer_id, borrowers(first_name, last_name))",
        )
        .neq("alert_type", "no_action")
        .order("severity", { ascending: true })
        .order("scored_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RateAlertAnalysis[];
    },
  });
}

export function useRateAlertByLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: alertKeys.byLoan(loanId ?? ""),
    queryFn: async (): Promise<RateAlertAnalysis | null> => {
      if (!loanId) return null;
      const { data, error } = await supabase
        .from("rate_alert_analyses")
        .select("*")
        .eq("loan_id", loanId)
        .order("scored_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RateAlertAnalysis | null;
    },
    enabled: !!loanId,
  });
}

export function useRateAlertSummary() {
  return useQuery({
    queryKey: alertKeys.summary(),
    queryFn: async (): Promise<RateAlertSummary> => {
      const { data, error } = await supabase
        .from("rate_alert_analyses")
        .select("alert_type")
        .neq("alert_type", "no_action");
      if (error) throw error;
      const rows = (data ?? []) as { alert_type: string }[];
      return {
        at_risk: rows.filter((r) => r.alert_type === "at_risk").length,
        float_down: rows.filter((r) => r.alert_type === "float_down").length,
        total: rows.length,
      };
    },
    refetchInterval: 60_000,
  });
}

export function useRunRateAlertScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "rate-alert-intelligence-agent",
        { body: {} },
      );
      if (error) {
        let msg = error.message || "Rate alert scan failed";
        if (error instanceof Response) {
          try {
            const j = await error.json();
            if (j?.error) msg = j.error;
          } catch { /* ignore */ }
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Rate alert scan failed");
      return data as {
        scanned: number;
        at_risk: number;
        float_down: number;
        no_action: number;
        ai_enriched: number;
        notifications: number;
        latency_ms: number;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      const alerts = data.at_risk + data.float_down;
      if (alerts > 0) {
        toast.success(`Scanned ${data.scanned} locks — ${alerts} alert(s) found`);
      } else {
        toast.success(`Scanned ${data.scanned} locks — all rates stable`);
      }
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to run rate alert scan");
    },
  });
}
