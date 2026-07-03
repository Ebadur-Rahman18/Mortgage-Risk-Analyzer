import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import { logActivity } from "@/lib/activity-logger";

export interface PipelinePriorityScore {
  id: string;
  loan_id: string;
  loan_officer_id: string | null;
  urgency_score: number;
  sla_risk_sub: number;
  lock_expiry_sub: number;
  engagement_sub: number;
  close_probability_sub: number;
  urgency_reason: string | null;
  ai_engagement_note: string | null;
  ai_close_note: string | null;
  model_used: string | null;
  metadata: Json;
  scored_at: string;
  loans?: {
    id: string;
    loan_number: string;
    status: string;
    loan_amount: number | null;
    lock_expiration_date: string | null;
    loan_officer_id: string | null;
    borrowers?: { first_name?: string; last_name?: string } | null;
    loan_risk_scores?: { risk_level: string; overall_risk_score: number } | null;
  } | null;
}

const priorityKeys = {
  all: ["pipeline_priority_scores"] as const,
  list: () => ["pipeline_priority_scores", "list"] as const,
  top: (limit: number) => ["pipeline_priority_scores", "top", limit] as const,
};

export function usePipelinePriorityScores() {
  return useQuery({
    queryKey: priorityKeys.list(),
    queryFn: async (): Promise<PipelinePriorityScore[]> => {
      const { data, error } = await supabase
        .from("pipeline_priority_scores")
        .select(
          "*, loans(id, loan_number, status, loan_amount, lock_expiration_date, loan_officer_id, borrowers(first_name, last_name), loan_risk_scores(risk_level, overall_risk_score))",
        )
        .order("urgency_score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PipelinePriorityScore[];
    },
  });
}

export function useTopPriorityLoans(limit = 10) {
  return useQuery({
    queryKey: priorityKeys.top(limit),
    queryFn: async (): Promise<PipelinePriorityScore[]> => {
      const { data, error } = await supabase
        .from("pipeline_priority_scores")
        .select(
          "*, loans(id, loan_number, status, loan_amount, lock_expiration_date, loan_officer_id, borrowers(first_name, last_name), loan_risk_scores(risk_level, overall_risk_score))",
        )
        .order("urgency_score", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as PipelinePriorityScore[];
    },
  });
}

export function useRunPipelinePrioritization() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!isAgentAllowedForUser("pipeline-prioritization-agent", profile)) {
        throw new Error("You don't have permission to run Pipeline Prioritization.");
      }
      const { data, error } = await supabase.functions.invoke(
        "pipeline-prioritization-agent",
        { body: {} },
      );
      if (error) {
        let msg = error.message || "Prioritization failed";
        const maybeError = error as unknown as { context?: Response };
        if (maybeError?.context instanceof Response) {
          try {
            const j = await maybeError.context.json();
            if (j?.error) msg = j.error;
          } catch { /* ignore */ }
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Prioritization failed");
      return data as { scored: number; ai_enriched: number; latency_ms: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: priorityKeys.all });
      logActivity({
        action: "update",
        resourceType: "pipeline",
        details: {
          operation: "pipeline_prioritization_run",
          scored: data.scored,
          ai_enriched: data.ai_enriched,
          latency_ms: data.latency_ms,
        },
      });
      toast.success(`Ranked ${data.scored} loan(s)`);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to rank pipeline");
    },
  });
}
