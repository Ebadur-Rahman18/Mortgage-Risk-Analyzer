import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";

export function useHmdaByLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.phase7.hmdaByLoan(loanId ?? ""),
    queryFn: async () => {
      if (!loanId) return null;
      const { data, error } = await supabase
        .from("hmda_lar_entries")
        .select("*")
        .eq("loan_id", loanId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!loanId,
  });
}

export function useHmdaByYear(filingYear: number) {
  return useQuery({
    queryKey: queryKeys.phase7.hmdaByYear(filingYear),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hmda_lar_entries")
        .select("*, loans(loan_number, branch_id, loan_amount)")
        .eq("filing_year", filingYear)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHmdaMutations(loanId: string) {
  const qc = useQueryClient();
  const upsert = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from("hmda_lar_entries")
        .select("id")
        .eq("loan_id", loanId)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from("hmda_lar_entries")
          .update({ ...patch, updated_at: now })
          .eq("id", existing.id);
        if (error) throw error;
        return existing.id;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("hmda_lar_entries")
        .insert({
          loan_id: loanId,
          ...patch,
          created_by: userData.user?.id ?? null,
          updated_at: now,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.phase7.hmdaByLoan(loanId) });
      qc.invalidateQueries({ queryKey: queryKeys.phase7.hmdaByYearAll });
    },
  });
  return { upsert };
}

export function useHmdaReportRuns() {
  return useQuery({
    queryKey: queryKeys.phase7.hmdaReportRuns,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hmda_report_runs")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLogHmdaRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      filing_year: number;
      total_rows: number;
      included_rows: number;
      excluded_rows: number;
      filters: Record<string, unknown>;
      summary: Record<string, unknown>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("hmda_report_runs").insert({
        ...row,
        generated_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.phase7.hmdaReportRuns }),
  });
}

export function useNmlsLicenses(search?: string) {
  return useQuery({
    queryKey: queryKeys.phase7.nmlsLicenses(search ?? ""),
    queryFn: async () => {
      let q = supabase.from("nmls_licenses").select("*").order("expiration_date", { ascending: true });
      if (search?.trim()) {
        const s = search.trim();
        q = q.or(`holder_name.ilike.%${s}%,license_number.ilike.%${s}%,state_code.ilike.%${s}%,nmls_id.ilike.%${s}%`);
      }
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNmlsLicenseMutations(search?: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.phase7.nmlsLicenses(search ?? "") });

  const upsert = useMutation({
    mutationFn: async (input: Record<string, unknown> & { id?: string }) => {
      const now = new Date().toISOString();
      if (input.id) {
        const { id, ...rest } = input;
        const { error } = await supabase
          .from("nmls_licenses")
          .update({ ...rest, updated_at: now })
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("nmls_licenses")
        .insert({
          ...input,
          created_by: userData.user?.id ?? null,
          updated_at: now,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nmls_licenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { upsert, remove };
}
