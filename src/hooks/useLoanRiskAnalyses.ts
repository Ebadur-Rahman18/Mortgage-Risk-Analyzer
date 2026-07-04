import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import { logCrud } from "@/lib/activity-logger";
import { extractEdgeFunctionErrorMessage } from "@/lib/edgeFunctionUtils";

export interface LoanRiskAnalysisRow {
  id: string;
  loan_id: string;
  run_by: string | null;
  risk_score: number;
  risk_level: string;
  summary: string;
  risk_factors: string[];
  recommendations: string[];
  dti: number | null;
  ltv: number | null;
  model_used: string | null;
  latency_ms: number | null;
  is_outdated: boolean;
  created_at: string;
}

function mapAnalysisRow(row: Record<string, unknown>): LoanRiskAnalysisRow {
  return {
    id: row.id as string,
    loan_id: row.loan_id as string,
    run_by: row.run_by as string | null,
    risk_score: row.risk_score as number,
    risk_level: row.risk_level as string,
    summary: (row.summary as string) ?? "",
    risk_factors: (row.risk_factors as string[]) ?? [],
    recommendations: (row.recommendations as string[]) ?? [],
    dti: row.dti != null ? Number(row.dti) : null,
    ltv: row.ltv != null ? Number(row.ltv) : null,
    model_used: row.model_used as string | null,
    latency_ms: row.latency_ms as number | null,
    is_outdated: Boolean(row.is_outdated),
    created_at: row.created_at as string,
  };
}

export function useLoanRiskAnalyses(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.loanRiskAnalyses.byLoan(loanId ?? ""),
    queryFn: async (): Promise<LoanRiskAnalysisRow[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_risk_analyses")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) =>
        mapAnalysisRow({
          ...row,
          risk_factors: row.risk_factors ?? [],
          recommendations: row.recommendations ?? [],
        }),
      );
    },
    enabled: !!loanId,
  });
}

export function useLatestLoanRiskAnalysis(loanId: string | undefined) {
  const { data: analyses, ...rest } = useLoanRiskAnalyses(loanId);
  const latest =
    analyses?.find((a) => !a.is_outdated) ?? analyses?.[0] ?? null;
  return { data: latest, analyses: analyses ?? [], ...rest };
}

export function useAnalyzeMortgage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (loanId: string) => {
      const { data, error } = await supabase.functions.invoke("analyze-mortgage", {
        body: { loan_id: loanId },
      });
      if (error) {
        throw new Error(await extractEdgeFunctionErrorMessage(error, data));
      }
      const body = data as { error?: string; analysis?: LoanRiskAnalysisRow & { riskScore?: number; riskLevel?: string; riskFactors?: string[] } };
      if (body?.error) throw new Error(body.error);
      return body.analysis;
    },
    onSuccess: (_result, loanId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loanRiskAnalyses.byLoan(loanId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.loanRiskAnalyses.dashboard });
      invalidateKeys.loans(queryClient);
      logCrud("create", "loan_risk_analysis", loanId, { source: "analyze-mortgage" });
      toast.success("Risk analysis complete");
    },
    onError: (e) => toast.error(e.message),
  });
}
