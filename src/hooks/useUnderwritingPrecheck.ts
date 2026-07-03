import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import { extractEdgeFunctionErrorMessage, isPersistedRowNewer } from "@/lib/edgeFunctionUtils";

export interface PrecheckItem {
  category: string;
  label: string;
  result: "pass" | "warning" | "fail";
  actual_value: string;
  threshold: string;
  guideline: string;
  issue_note: string;
  remediation?: string;
}

export interface AiRemediation {
  category: string;
  recommendation: string;
  guideline_ref: string;
}

export interface UnderwritingPrecheckRow {
  id: string;
  loan_id: string;
  run_by: string | null;
  overall_result: "pass" | "warning" | "fail";
  pass_count: number;
  warn_count: number;
  fail_count: number;
  checks: PrecheckItem[];
  ai_summary: string | null;
  ai_remediation: AiRemediation[];
  model_used: string | null;
  latency_ms: number | null;
  metadata: Json;
  created_at: string;
}

const precheckKeys = {
  all: ["underwriting_prechecks"] as const,
  byLoan: (loanId: string) => ["underwriting_prechecks", loanId] as const,
};

export function useUnderwritingPrecheckHistory(loanId: string | undefined) {
  return useQuery({
    queryKey: precheckKeys.byLoan(loanId ?? ""),
    queryFn: async (): Promise<UnderwritingPrecheckRow[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("underwriting_prechecks")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        overall_result: row.overall_result as "pass" | "warning" | "fail",
        checks: (row.checks ?? []) as unknown as PrecheckItem[],
        ai_remediation: (row.ai_remediation ?? []) as unknown as AiRemediation[],
      }));
    },
    enabled: !!loanId,
  });
}

export function useRunUnderwritingPrecheck() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (loanId: string) => {
      if (!isAgentAllowedForUser("underwriter-precheck-agent", profile)) {
        throw new Error("You don't have permission to run Underwriting Pre-Check.");
      }
      const invokeStartedAt = Date.now();
      const beforeLatest = (queryClient.getQueryData(precheckKeys.byLoan(loanId)) as UnderwritingPrecheckRow[] | undefined)?.[0] ?? null;
      const beforeLatestId = beforeLatest?.id ?? null;
      const beforeLatestCreatedAt = beforeLatest?.created_at ?? null;
      const { data, error } = await supabase.functions.invoke(
        "underwriter-precheck-agent",
        { body: { loan_id: loanId }, timeout: 120_000 },
      );
      if (error) {
        const msg = await extractEdgeFunctionErrorMessage(error, "Pre-check failed");
        try {
          const { data: latestRow, error: latestErr } = await supabase
            .from("underwriting_prechecks")
            .select("*")
            .eq("loan_id", loanId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!latestErr && latestRow) {
            const latestId = String((latestRow as any).id ?? "");
            const latestCreatedAt = (latestRow as any).created_at as string | undefined;
            if (
              isPersistedRowNewer({
                invokeStartedAt,
                beforeId: beforeLatestId,
                beforeCreatedAt: beforeLatestCreatedAt,
                latestId,
                latestCreatedAt: latestCreatedAt ?? null,
              })
            ) {
              // Treat as success: edge invoke failed, but results were persisted.
              return {
                ...(latestRow as any),
                overall_result: (latestRow as any).overall_result as "pass" | "warning" | "fail",
                checks: ((latestRow as any).checks ?? []) as unknown as PrecheckItem[],
                ai_remediation: ((latestRow as any).ai_remediation ?? []) as unknown as AiRemediation[],
              } as UnderwritingPrecheckRow;
            }
          }
        } catch {
          // ignore; fall through to throw original error
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Pre-check failed");
      return data as UnderwritingPrecheckRow;
    },
    onSuccess: (_data, loanId) => {
      queryClient.invalidateQueries({ queryKey: precheckKeys.byLoan(loanId) });
      toast.success("Pre-check completed");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to run pre-check");
    },
  });
}
