import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface LoanRiskScore {
  id: string;
  loan_id: string;
  overall_risk_score: number;
  risk_level: string;
  risk_factors: unknown;
  stall_risk: number | null;
  lock_expiry_risk: number | null;
  condition_risk: number | null;
  calculated_at: string;
  created_at: string;
  updated_at: string;
}

const riskKeys = {
  all: ["loan_risk_scores"] as const,
  byLoan: (loanId: string) => ["loan_risk_scores", loanId] as const,
};

export function useLoanRiskScore(loanId: string | undefined) {
  return useQuery({
    queryKey: riskKeys.byLoan(loanId ?? ""),
    queryFn: async (): Promise<LoanRiskScore | null> => {
      if (!loanId) return null;
      const { data, error } = await supabase
        .from("loan_risk_scores")
        .select("*")
        .eq("loan_id", loanId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as LoanRiskScore | null;
    },
    enabled: !!loanId,
  });
}

export { riskKeys };
