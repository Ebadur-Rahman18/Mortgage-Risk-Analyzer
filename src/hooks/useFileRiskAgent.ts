import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { riskKeys } from "@/hooks/useLoanRiskScore";
import { useAuth } from "@/contexts/AuthContext";
import { isAgentAllowedForUser } from "@/lib/agentRoles";

export interface RiskFactor {
  type: string;
  description: string;
  weight: number;
}

export interface LoanRiskResult {
  loan_id: string;
  loan_number: string;
  borrower_name: string;
  risk_level: "low" | "medium" | "high" | "critical";
  overall_risk_score: number;
  stall_risk: number;
  lock_expiry_risk: number;
  condition_risk: number;
  milestone_risk: number;
  risk_factors: RiskFactor[];
}

export interface FileRiskAgentResponse {
  results: LoanRiskResult[];
  analyzed_at: string;
}

export interface FileRiskAgentInput {
  loanIds?: string[];
}

export function useFileRiskAgent() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation<FileRiskAgentResponse, Error, FileRiskAgentInput>({
    mutationFn: async ({ loanIds }) => {
      if (!isAgentAllowedForUser("file-risk-agent", profile)) {
        throw new Error("You don't have permission to run File Risk Analysis.");
      }
      const body: Record<string, unknown> = {};
      if (loanIds && loanIds.length > 0) {
        body.loan_ids = loanIds;
      }

      const { data, error } = await supabase.functions.invoke("file-risk-agent", {
        body,
      });

      if (error) throw error;
      return data as FileRiskAgentResponse;
    },
    onSuccess: (data) => {
      // Invalidate all individual loan risk score queries so RiskBadge refreshes
      queryClient.invalidateQueries({ queryKey: riskKeys.all });

      const count = data.results.length;
      const criticalCount = data.results.filter(r => r.risk_level === "critical").length;
      const highCount = data.results.filter(r => r.risk_level === "high").length;

      if (criticalCount > 0) {
        toast.warning(`Analysis complete: ${criticalCount} critical risk loan(s) found`);
      } else if (highCount > 0) {
        toast.info(`Analysis complete: ${count} loan(s) analyzed, ${highCount} high risk`);
      } else {
        toast.success(`Analysis complete: ${count} loan(s) analyzed`);
      }
    },
    onError: (err) => {
      toast.error(`Risk analysis failed: ${err.message}`);
    },
  });
}
