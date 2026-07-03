import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { riskKeys } from "@/hooks/useLoanRiskScore";

function triggerRiskRecalculation(loanId: string) {
  supabase.functions.invoke("calculate-loan-risk", { body: { loan_id: loanId } }).catch(() => {});
}

function triggerAutoDraftCommunication(loanId: string, milestoneType: string, milestoneName: string) {
  supabase.functions.invoke("auto-draft-milestone-comm", {
    body: { loan_id: loanId, milestone_type: milestoneType, milestone_name: milestoneName },
  }).catch(() => {});
}

export interface LoanMilestone {
  id: string;
  loan_id: string;
  milestone_type: string;
  name: string;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  external_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanMilestoneInsert {
  loan_id: string;
  milestone_type: string;
  name: string;
  due_date?: string | null;
  notes?: string | null;
}

const milestoneKeys = {
  all: ["loan_milestones"] as const,
  byLoan: (loanId: string) => ["loan_milestones", loanId] as const,
};

export function useLoanMilestones(loanId: string | undefined) {
  return useQuery({
    queryKey: milestoneKeys.byLoan(loanId ?? ""),
    queryFn: async (): Promise<LoanMilestone[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_milestones")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LoanMilestone[];
    },
    enabled: !!loanId,
  });
}

export function useCreateLoanMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoanMilestoneInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("loan_milestones")
        .insert({
          ...input,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LoanMilestone;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: milestoneKeys.byLoan(variables.loan_id) });
      triggerRiskRecalculation(variables.loan_id);
      queryClient.invalidateQueries({ queryKey: riskKeys.byLoan(variables.loan_id) });
      toast.success("Milestone added");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateLoanMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, loanId, data }: { id: string; loanId: string; data: Partial<LoanMilestone> }) => {
      const { data: out, error } = await supabase
        .from("loan_milestones")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return out as LoanMilestone;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: milestoneKeys.byLoan(variables.loanId) });
      triggerRiskRecalculation(variables.loanId);
      queryClient.invalidateQueries({ queryKey: riskKeys.byLoan(variables.loanId) });
      if (variables.data.completed_at && data) {
        triggerAutoDraftCommunication(variables.loanId, data.milestone_type, data.name);
      }
      toast.success("Milestone updated");
    },
    onError: (e) => toast.error(e.message),
  });
}
