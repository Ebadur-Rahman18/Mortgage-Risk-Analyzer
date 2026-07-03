import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";

export type InvestorSubmissionStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "cleared"
  | "rejected";

export interface InvestorSubmissionRow {
  id: string;
  loan_id: string;
  investor_code: string;
  status: InvestorSubmissionStatus;
  submitted_at: string | null;
  cleared_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InvestorSubmissionScopedRow extends InvestorSubmissionRow {
  loans?: { loan_number: string | null; branch_id: string | null } | null;
}

/** All investor submissions visible under RLS (branch / LO / UW scope). */
export function useInvestorSubmissionsScoped(search?: string) {
  return useQuery({
    queryKey: [...queryKeys.pricing.investorSubmissionsScoped, search ?? ""] as const,
    queryFn: async (): Promise<InvestorSubmissionScopedRow[]> => {
      let q = supabase
        .from("investor_submissions")
        .select("*, loans(loan_number, branch_id)")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (search?.trim()) {
        q = q.ilike("investor_code", `%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InvestorSubmissionScopedRow[];
    },
    staleTime: 30_000,
  });
}

export function useInvestorSubmissions(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pricing.investorByLoan(loanId ?? ""),
    queryFn: async (): Promise<InvestorSubmissionRow[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("investor_submissions")
        .select("*")
        .eq("loan_id", loanId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvestorSubmissionRow[];
    },
    enabled: !!loanId,
  });
}

export function useInvestorSubmissionMutations(loanId: string) {
  const qc = useQueryClient();

  const upsertDraft = useMutation({
    mutationFn: async (input: {
      id?: string;
      investor_code: string;
      notes?: string;
      status?: InvestorSubmissionStatus;
    }) => {
      const now = new Date().toISOString();
      if (input.id) {
        const { error } = await supabase
          .from("investor_submissions")
          .update({
            investor_code: input.investor_code,
            notes: input.notes ?? null,
            status: input.status ?? "draft",
            updated_at: now,
            ...(input.status === "submitted" ? { submitted_at: now } : {}),
            ...(input.status === "cleared" ? { cleared_at: now } : {}),
          })
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("investor_submissions")
        .insert({
          loan_id: loanId,
          investor_code: input.investor_code || "TBD",
          status: input.status ?? "draft",
          notes: input.notes ?? null,
          updated_at: now,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pricing.investorByLoan(loanId) });
      qc.invalidateQueries({ queryKey: ["pricing", "investorSubmissions"] });
    },
  });

  const logStubSubmit = useMutation({
    mutationFn: async (submissionId: string) => {
      const { data, error } = await supabase.functions.invoke("submit-investor-package", {
        body: { loan_id: loanId, submission_id: submissionId },
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data) {
        throw new Error(String((data as { error?: string }).error ?? "Submit failed"));
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pricing.investorByLoan(loanId) });
      qc.invalidateQueries({ queryKey: ["pricing", "investorSubmissions"] });
    },
  });

  return { upsertDraft, logStubSubmit };
}
