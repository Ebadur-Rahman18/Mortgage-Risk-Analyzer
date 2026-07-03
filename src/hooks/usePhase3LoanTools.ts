import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
export interface ComplianceRuleResultRow {
  code: string;
  title: string;
  regulation_tag: string;
  severity: string;
  blocking: boolean;
  pass: boolean;
  message: string;
}

export function useRunComplianceRules(loanId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!loanId) throw new Error("No loan");
      const { data, error } = await supabase.functions.invoke("run-compliance-rules", {
        body: { loan_id: loanId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { results: ComplianceRuleResultRow[]; summary: Record<string, unknown> };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance_rule_runs", loanId] });
      toast.success("Compliance rules evaluated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useComplianceRuleRuns(loanId: string | undefined) {
  return useQuery({
    queryKey: ["compliance_rule_runs", loanId ?? ""],
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("compliance_rule_runs")
        .select("*")
        .eq("loan_id", loanId)
        .order("run_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loanId,
  });
}

export function useCalculateClosingCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      loan_id?: string;
      loan_amount: number;
      estimate_type?: string;
      persist?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("calculate-closing-costs", {
        body: payload,
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as {
        lines: Array<Record<string, unknown>>;
        total_borrower: number;
        disclaimer: string;
        persisted_id: string | null;
      };
    },
    onSuccess: (_d, vars) => {
      if (vars.loan_id) {
        qc.invalidateQueries({ queryKey: ["loan_fee_estimates", vars.loan_id] });
      }
      if (vars.persist) toast.success("Closing cost estimate saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLoanFeeEstimates(loanId: string | undefined) {
  return useQuery({
    queryKey: ["loan_fee_estimates", loanId ?? ""],
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_fee_estimates")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loanId,
  });
}

export interface QcTemplateItem {
  id: string;
  label: string;
  category?: string;
  required?: boolean;
}

export function useActiveQcTemplate() {
  return useQuery({
    queryKey: ["qc_checklist_templates", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qc_checklist_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        items: QcTemplateItem[];
      } | null;
    },
  });
}

export function useLoanQcResults(loanId: string | undefined) {
  return useQuery({
    queryKey: ["loan_qc_results", loanId ?? ""],
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await supabase.from("loan_qc_results").select("*").eq("loan_id", loanId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loanId,
  });
}

export function useUpsertLoanQcResult(loanId: string | undefined, templateId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      item_key: string;
      status: "pass" | "fail" | "na";
      notes?: string | null;
    }) => {
      if (!loanId) throw new Error("No loan");
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("loan_qc_results").upsert(
        {
          loan_id: loanId,
          template_id: templateId,
          item_key: input.item_key,
          status: input.status,
          notes: input.notes ?? null,
          checked_by: user?.id ?? null,
          checked_at: new Date().toISOString(),
        },
        { onConflict: "loan_id,item_key" },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loan_qc_results", loanId] });
      toast.success("QC item saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAusSubmissions(loanId: string | undefined) {
  return useQuery({
    queryKey: ["aus_submissions", loanId ?? ""],
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("aus_submissions")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loanId,
  });
}

export function useSubmitAusRequest(loanId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: "du" | "lp") => {
      if (!loanId) throw new Error("No loan");
      const { data, error } = await supabase.functions.invoke("submit-aus-request", {
        body: { loan_id: loanId, provider },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aus_submissions", loanId] });
      toast.success("AUS request recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
