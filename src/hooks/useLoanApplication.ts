import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface LoanAsset {
  id: string;
  loan_id: string;
  borrower_id: string;
  asset_type: string;
  institution: string | null;
  account_number: string | null;
  balance: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanLiability {
  id: string;
  loan_id: string;
  borrower_id: string;
  liability_type: string;
  creditor: string | null;
  account_number: string | null;
  monthly_payment: number | null;
  unpaid_balance: number | null;
  months_remaining: number | null;
  to_be_paid_off: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanReo {
  id: string;
  loan_id: string;
  borrower_id: string;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  property_postal_code: string | null;
  property_type: string | null;
  market_value: number | null;
  mortgage_balance: number | null;
  monthly_mortgage: number | null;
  rental_income: number | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanDeclarations {
  id: string;
  loan_id: string;
  borrower_id: string;
  declarations: Record<string, boolean | string>;
  created_at: string;
  updated_at: string;
}

const appKeys = {
  assets: (loanId: string) => ["loan_assets", loanId] as const,
  liabilities: (loanId: string) => ["loan_liabilities", loanId] as const,
  reo: (loanId: string) => ["loan_reo", loanId] as const,
  declarations: (loanId: string) => ["loan_declarations", loanId] as const,
};

// ── Assets ──────────────────────────────────────────────────────────────────
export function useLoanAssets(loanId: string | undefined) {
  return useQuery({
    queryKey: appKeys.assets(loanId ?? ""),
    queryFn: async (): Promise<LoanAsset[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_assets")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanAsset[];
    },
    enabled: !!loanId,
  });
}

export function useCreateLoanAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<LoanAsset, "id" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("loan_assets")
        .insert({ ...input, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: appKeys.assets(v.loan_id) });
      toast.success("Asset added");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteLoanAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, loanId }: { id: string; loanId: string }) => {
      const { error } = await supabase.from("loan_assets").delete().eq("id", id);
      if (error) throw error;
      return { id, loanId };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: appKeys.assets(v.loanId) });
      toast.success("Asset deleted");
    },
    onError: (e) => toast.error(e.message),
  });
}

// ── Liabilities ─────────────────────────────────────────────────────────────
export function useLoanLiabilities(loanId: string | undefined) {
  return useQuery({
    queryKey: appKeys.liabilities(loanId ?? ""),
    queryFn: async (): Promise<LoanLiability[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_liabilities")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanLiability[];
    },
    enabled: !!loanId,
  });
}

export function useCreateLoanLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<LoanLiability, "id" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("loan_liabilities")
        .insert({ ...input, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: appKeys.liabilities(v.loan_id) });
      toast.success("Liability added");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteLoanLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, loanId }: { id: string; loanId: string }) => {
      const { error } = await supabase.from("loan_liabilities").delete().eq("id", id);
      if (error) throw error;
      return { id, loanId };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: appKeys.liabilities(v.loanId) });
      toast.success("Liability deleted");
    },
    onError: (e) => toast.error(e.message),
  });
}

// ── REO ─────────────────────────────────────────────────────────────────────
export function useLoanReo(loanId: string | undefined) {
  return useQuery({
    queryKey: appKeys.reo(loanId ?? ""),
    queryFn: async (): Promise<LoanReo[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_reo")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanReo[];
    },
    enabled: !!loanId,
  });
}

export function useCreateLoanReo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<LoanReo, "id" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("loan_reo")
        .insert({ ...input, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: appKeys.reo(v.loan_id) });
      toast.success("Property added");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteLoanReo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, loanId }: { id: string; loanId: string }) => {
      const { error } = await supabase.from("loan_reo").delete().eq("id", id);
      if (error) throw error;
      return { id, loanId };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: appKeys.reo(v.loanId) });
      toast.success("Property deleted");
    },
    onError: (e) => toast.error(e.message),
  });
}

// ── Declarations ────────────────────────────────────────────────────────────
export function useLoanDeclarations(loanId: string | undefined, borrowerId: string | undefined) {
  return useQuery({
    queryKey: appKeys.declarations(loanId ?? ""),
    queryFn: async (): Promise<LoanDeclarations | null> => {
      if (!loanId || !borrowerId) return null;
      const { data, error } = await supabase
        .from("loan_declarations")
        .select("*")
        .eq("loan_id", loanId)
        .eq("borrower_id", borrowerId)
        .maybeSingle();
      if (error) throw error;
      return data as LoanDeclarations | null;
    },
    enabled: !!loanId && !!borrowerId,
  });
}

export function useUpsertLoanDeclarations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { loan_id: string; borrower_id: string; declarations: Record<string, boolean | string> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("loan_declarations")
        .upsert(
          {
            loan_id: input.loan_id,
            borrower_id: input.borrower_id,
            declarations: input.declarations,
            created_by: user?.id ?? null,
          },
          { onConflict: "loan_id,borrower_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: appKeys.declarations(v.loan_id) });
      toast.success("Declarations saved");
    },
    onError: (e) => toast.error(e.message),
  });
}
