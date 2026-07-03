import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { extractEdgeFunctionErrorMessage, isPersistedRowNewer } from "@/lib/edgeFunctionUtils";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { isAgentAllowedForUser } from "@/lib/agentRoles";

export interface ComplianceCheckItem {
  code: string;
  regulation_group: string;
  name: string;
  result: "pass" | "warning" | "fail";
  actual_value: string;
  citation: string;
  issue_note: string;
  remediation?: string;
}

export interface AiRemediation {
  code: string;
  recommendation: string;
  citation_ref: string;
  urgency: string;
}

export interface ComplianceScreeningRow {
  id: string;
  loan_id: string;
  run_by: string | null;
  overall_result: "pass" | "warning" | "fail";
  pass_count: number;
  warn_count: number;
  fail_count: number;
  checks: ComplianceCheckItem[];
  ai_summary: string | null;
  ai_remediation: AiRemediation[];
  model_used: string | null;
  latency_ms: number | null;
  metadata: Json;
  created_at: string;
}

const keys = {
  all: ["compliance_screenings"] as const,
  byLoan: (loanId: string) => ["compliance_screenings", loanId] as const,
};

export function useComplianceScreeningHistory(loanId: string | undefined) {
  return useQuery({
    queryKey: keys.byLoan(loanId ?? ""),
    queryFn: async (): Promise<ComplianceScreeningRow[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("compliance_screenings")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        overall_result: row.overall_result as "pass" | "warning" | "fail",
        checks: (row.checks ?? []) as unknown as ComplianceCheckItem[],
        ai_remediation: (row.ai_remediation ?? []) as unknown as AiRemediation[],
      }));
    },
    enabled: !!loanId,
  });
}

export function useRunComplianceScreening() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (loanId: string) => {
      if (!isAgentAllowedForUser("compliance-screening-agent", profile)) {
        throw new Error("You don't have permission to run Compliance Screening.");
      }

      const invokeStartedAt = Date.now();

      const beforeLatest = (queryClient.getQueryData(keys.byLoan(loanId)) as
        | ComplianceScreeningRow[]
        | undefined)?.[0] ?? null;
      const beforeLatestId = beforeLatest?.id ?? null;
      const beforeLatestCreatedAt = beforeLatest?.created_at ?? null;

      const { data, error } = await supabase.functions.invoke(
        "compliance-screening-agent",
        {
          body: { loan_id: loanId },
          /** AI + DB can exceed default browser/fetch limits on cold starts. */
          timeout: 120_000,
        },
      );

      if (error) {
        const msg = await extractEdgeFunctionErrorMessage(
          error,
          "Compliance screening failed",
        );

        // If the edge function failed from the client's perspective (non-2xx / timeout)
        // but already persisted a new screening row, treat it as success so the UI
        // can immediately render the latest result.
        try {
          const { data: latestRow, error: latestErr } = await supabase
            .from("compliance_screenings")
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
              return {
                ...(latestRow as any),
                overall_result: (latestRow as any).overall_result as
                  | "pass"
                  | "warning"
                  | "fail",
                checks: ((latestRow as any).checks ?? []) as unknown as ComplianceCheckItem[],
                ai_remediation: ((latestRow as any).ai_remediation ?? []) as unknown as AiRemediation[],
              } as ComplianceScreeningRow;
            }
          }
        } catch {
          // Best-effort only.
        }

        throw new Error(msg);
      }
      if (data?.error)
        throw new Error(
          typeof data.error === "string" ? data.error : "Compliance screening failed",
        );
      return data as ComplianceScreeningRow;
    },
    onSuccess: (_data, loanId) => {
      queryClient.invalidateQueries({ queryKey: keys.byLoan(loanId) });
      toast.success("Compliance screening completed");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to run compliance screening");
    },
  });
}
