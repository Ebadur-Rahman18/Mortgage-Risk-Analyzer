import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";
import {
  COPILOT_STATUS_GROUPS,
  type CopilotStatusGroup,
  getCopilotStatusGroup,
} from "@/lib/mortgage-calculations";
import type { LoanRiskAnalysisRow } from "@/hooks/useLoanRiskAnalyses";

export interface RiskDashboardStats {
  totalLoans: number;
  byStatusGroup: Record<CopilotStatusGroup, number>;
  byRiskLevel: Record<string, number>;
  recentlyAnalyzed: Array<{
    loan_id: string;
    loan_number: string;
    borrower_name: string;
    risk_score: number;
    risk_level: string;
    summary: string;
    analyzed_at: string;
  }>;
  latestSummaries: Array<{ loan_number: string; summary: string; risk_level: string }>;
}

async function fetchLatestAnalysesByLoan(): Promise<Map<string, LoanRiskAnalysisRow>> {
  const { data, error } = await supabase
    .from("loan_risk_analyses")
    .select("*")
    .eq("is_outdated", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const map = new Map<string, LoanRiskAnalysisRow>();
  for (const row of data ?? []) {
    if (!map.has(row.loan_id)) {
      map.set(row.loan_id, {
        id: row.id,
        loan_id: row.loan_id,
        run_by: row.run_by,
        risk_score: row.risk_score,
        risk_level: row.risk_level,
        summary: row.summary ?? "",
        risk_factors: (row.risk_factors as string[]) ?? [],
        recommendations: (row.recommendations as string[]) ?? [],
        dti: row.dti != null ? Number(row.dti) : null,
        ltv: row.ltv != null ? Number(row.ltv) : null,
        model_used: row.model_used,
        latency_ms: row.latency_ms,
        is_outdated: row.is_outdated,
        created_at: row.created_at,
      });
    }
  }
  return map;
}

export function useMortgageRiskDashboard() {
  return useQuery({
    queryKey: queryKeys.loanRiskAnalyses.dashboard,
    queryFn: async (): Promise<RiskDashboardStats> => {
      const [{ data: loans, error: loansErr }, analysisMap] = await Promise.all([
        supabase
          .from("loans")
          .select("id, loan_number, status, borrowers(first_name, last_name)")
          .order("updated_at", { ascending: false })
          .limit(500),
        fetchLatestAnalysesByLoan(),
      ]);

      if (loansErr) throw loansErr;

      const byStatusGroup: Record<CopilotStatusGroup, number> = {
        pending: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
      };

      const byRiskLevel: Record<string, number> = { high: 0, medium: 0, low: 0 };

      const recentlyAnalyzed: RiskDashboardStats["recentlyAnalyzed"] = [];

      for (const loan of loans ?? []) {
        const group = getCopilotStatusGroup(loan.status);
        if (group) byStatusGroup[group]++;

        const analysis = analysisMap.get(loan.id);
        if (analysis) {
          const level = analysis.risk_level.toLowerCase();
          if (level in byRiskLevel) byRiskLevel[level]++;

          const b = loan.borrowers as { first_name?: string; last_name?: string } | null;
          recentlyAnalyzed.push({
            loan_id: loan.id,
            loan_number: loan.loan_number,
            borrower_name: b
              ? [b.first_name, b.last_name].filter(Boolean).join(" ")
              : "—",
            risk_score: analysis.risk_score,
            risk_level: analysis.risk_level,
            summary: analysis.summary,
            analyzed_at: analysis.created_at,
          });
        }
      }

      recentlyAnalyzed.sort(
        (a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime(),
      );

      const latestSummaries = recentlyAnalyzed.slice(0, 5).map((r) => ({
        loan_number: r.loan_number,
        summary: r.summary,
        risk_level: r.risk_level,
      }));

      return {
        totalLoans: loans?.length ?? 0,
        byStatusGroup,
        byRiskLevel,
        recentlyAnalyzed: recentlyAnalyzed.slice(0, 10),
        latestSummaries,
      };
    },
  });
}

export { COPILOT_STATUS_GROUPS };
