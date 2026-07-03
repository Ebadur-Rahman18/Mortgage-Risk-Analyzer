import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";

export interface LoanStageTransition {
  id: string;
  from_status: string;
  to_status: string;
  required_role: string | null;
  label: string | null;
  auto_milestone: string | null;
}

const transitionKeys = {
  all: ["loan_stage_transitions"] as const,
  forStatus: (status: string) => ["loan_stage_transitions", status] as const,
};

export function useAvailableTransitions(currentStatus: string | undefined) {
  return useQuery({
    queryKey: transitionKeys.forStatus(currentStatus ?? ""),
    queryFn: async (): Promise<LoanStageTransition[]> => {
      if (!currentStatus) return [];
      const { data, error } = await supabase
        .from("loan_stage_transitions")
        .select("*")
        .eq("from_status", currentStatus)
        .order("to_status");
      if (error) throw error;
      return (data ?? []) as LoanStageTransition[];
    },
    enabled: !!currentStatus,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTransitionLoanStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ loanId, toStatus }: { loanId: string; toStatus: string }) => {
      const { data, error } = await supabase.functions.invoke("transition-loan-status", {
        body: { loan_id: loanId, to_status: toStatus },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      invalidateKeys.loans(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: ["loan_timeline_events", variables.loanId] });
      queryClient.invalidateQueries({ queryKey: ["loan_milestones", variables.loanId] });
      toast.success(`Loan status updated to ${_data.to_status}`);
    },
    onError: (e) => toast.error(e.message),
  });
}
