import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface EligibilityResult {
  program_id: string;
  program_code: string;
  program_name: string;
  product_name: string;
  product_type: string;
  status: "eligible" | "ineligible" | "eligible_with_conditions";
  reasons: string[];
  conditions: string[];
}

export interface EligibilityResponse {
  scenario: {
    credit_score: number;
    ltv: number;
    dti: number;
    loan_amount: number;
    property_type: string;
    occupancy_type: string;
    state: string;
  };
  results: EligibilityResult[];
  eligible_count: number;
  total_programs: number;
}

export function useCheckEligibility() {
  return useMutation({
    mutationFn: async (input: { loanId?: string; scenario?: Record<string, unknown> }): Promise<EligibilityResponse> => {
      const body: Record<string, unknown> = {};
      if (input.loanId) body.loan_id = input.loanId;
      if (input.scenario) body.scenario = input.scenario;

      const { data, error } = await supabase.functions.invoke("check-eligibility", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as EligibilityResponse;
    },
    onError: (e) => toast.error(e.message),
  });
}
