import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { riskKeys } from "@/hooks/useLoanRiskScore";

function triggerRiskRecalculation(loanId: string) {
  supabase.functions.invoke("calculate-loan-risk", { body: { loan_id: loanId } }).catch(() => {});
}

function triggerConditionWorkflow(conditionId: string, loanId: string) {
  supabase.functions
    .invoke("condition-workflow-engine", {
      body: { condition_id: conditionId, loan_id: loanId },
    })
    .catch(() => {});
}

export interface LoanCondition {
  id: string;
  loan_id: string;
  condition_type: string;
  category: string | null;
  description: string;
  status: string;
  due_date: string | null;
  received_at: string | null;
  notes: string | null;
  external_id: string | null;
  created_by: string | null;
  assigned_party: string | null;
  assigned_to_user_id: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface LoanConditionInsert {
  loan_id: string;
  condition_type: string;
  category?: string | null;
  description: string;
  status?: string;
  due_date?: string | null;
  notes?: string | null;
  assigned_party?: string | null;
  priority?: string;
}

export interface ConditionWorkflowRule {
  id: string;
  condition_type: string;
  category_keyword: string;
  assigned_party: string;
  auto_due_days: number;
  priority: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const conditionKeys = {
  all: ["loan_conditions"] as const,
  byLoan: (loanId: string) => ["loan_conditions", loanId] as const,
  workflowRules: ["condition_workflow_rules"] as const,
  assigneeProfiles: (loanId: string) => ["condition_assignees", loanId] as const,
};

export function useLoanConditions(loanId: string | undefined) {
  return useQuery({
    queryKey: conditionKeys.byLoan(loanId ?? ""),
    queryFn: async (): Promise<LoanCondition[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_conditions")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanCondition[];
    },
    enabled: !!loanId,
  });
}

export function useCreateLoanCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoanConditionInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("loan_conditions")
        .insert({
          ...input,
          status: input.status ?? "pending",
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LoanCondition;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: conditionKeys.byLoan(variables.loan_id) });
      triggerRiskRecalculation(variables.loan_id);
      queryClient.invalidateQueries({ queryKey: riskKeys.byLoan(variables.loan_id) });
      triggerConditionWorkflow(data.id, variables.loan_id);
      toast.success("Condition added");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateLoanCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, loanId, data }: { id: string; loanId: string; data: Partial<LoanCondition> }) => {
      const { data: out, error } = await supabase
        .from("loan_conditions")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return out as LoanCondition;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: conditionKeys.byLoan(variables.loanId) });
      triggerRiskRecalculation(variables.loanId);
      queryClient.invalidateQueries({ queryKey: riskKeys.byLoan(variables.loanId) });
      toast.success("Condition updated");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useConditionWorkflowRules() {
  return useQuery({
    queryKey: conditionKeys.workflowRules,
    queryFn: async (): Promise<ConditionWorkflowRule[]> => {
      const { data, error } = await supabase
        .from("condition_workflow_rules")
        .select("*")
        .eq("is_enabled", true)
        .order("condition_type")
        .order("category_keyword");
      if (error) throw error;
      return (data ?? []) as ConditionWorkflowRule[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useConditionAssigneeProfiles(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  return useQuery({
    queryKey: [...conditionKeys.assigneeProfiles(""), ...uniqueIds],
    queryFn: async () => {
      if (uniqueIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", uniqueIds);
      if (error) throw error;
      const map: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {};
      for (const p of data ?? []) {
        map[p.id] = { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url };
      }
      return map;
    },
    enabled: uniqueIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
