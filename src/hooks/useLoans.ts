import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { logCrud } from "@/lib/activity-logger";
import { demoLoanSourcesInList } from "@/lib/demoData";
import { useHideDemoData } from "@/hooks/useHideDemoData";

export interface Loan {
  id: string;
  loan_number: string;
  borrower_id: string;
  loan_officer_id: string;
  product_id: string | null;
  program_id: string | null;
  branch_id: string | null;
  underwriter_id: string | null;
  status: string;
  loan_amount: number | null;
  appraised_value: number | null;
  ltv: number | null;
  credit_score: number | null;
  dti: number | null;
  purpose: string | null;
  occupancy_type: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_postal_code: string | null;
  lock_date: string | null;
  lock_expiration_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  data_source: string | null;
  external_id: string | null;
  api_payload: Json | null;
  loan_type?: string | null;
  interest_rate?: number | null;
  annual_income?: number | null;
  monthly_debt?: number | null;
  employment_years?: number | null;
  down_payment?: number | null;
  loan_term_months?: number | null;
  borrowers?:
    | { first_name?: string; last_name?: string; email?: string }
    | { first_name?: string; last_name?: string; email?: string }[]
    | null;
  /** Latest Risk Copilot analysis (attached in list queries). */
  latest_risk_analysis?: {
    risk_level: string;
    risk_score: number;
    is_outdated: boolean;
  } | null;
  /** @deprecated pipeline risk score — use latest_risk_analysis for Copilot */
  loan_risk_scores?: {
    risk_level: string;
    overall_risk_score: number;
  } | null;
}

export interface LoanInsert {
  loan_number?: string;
  borrower_id: string;
  loan_officer_id: string;
  product_id?: string | null;
  program_id?: string | null;
  branch_id?: string | null;
  underwriter_id?: string | null;
  status?: string;
  loan_amount?: number | null;
  appraised_value?: number | null;
  ltv?: number | null;
  credit_score?: number | null;
  dti?: number | null;
  loan_type?: string | null;
  interest_rate?: number | null;
  annual_income?: number | null;
  monthly_debt?: number | null;
  employment_years?: number | null;
  down_payment?: number | null;
  loan_term_months?: number | null;
  purpose?: string | null;
  occupancy_type?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null;
  lock_date?: string | null;
  lock_expiration_date?: string | null;
  data_source?: string | null;
  external_id?: string | null;
  api_payload?: Json | null;
}

export const LOANS_PAGE_SIZE = 25;

export interface LoansPaginatedResult {
  rows: Loan[];
  totalCount: number;
}

interface LoanQueryFilters {
  search?: string;
  status?: string;
  loanType?: string;
  riskLevel?: string;
  page?: number;
  dataSource?: string;
  hideDemo?: boolean;
}

async function fetchBorrowerIdsByName(search: string): Promise<string[]> {
  const term = search.trim();
  if (!term) return [];
  const { data, error } = await supabase
    .from("borrowers")
    .select("id")
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
  if (error) throw error;
  return (data ?? []).map((b) => b.id);
}

async function fetchLatestAnalysesMap(): Promise<
  Map<string, { risk_level: string; risk_score: number; is_outdated: boolean }>
> {
  const { data, error } = await supabase
    .from("loan_risk_analyses")
    .select("loan_id, risk_level, risk_score, is_outdated, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, { risk_level: string; risk_score: number; is_outdated: boolean }>();
  for (const row of data ?? []) {
    if (!map.has(row.loan_id)) {
      map.set(row.loan_id, {
        risk_level: row.risk_level,
        risk_score: row.risk_score,
        is_outdated: row.is_outdated,
      });
    }
  }
  return map;
}

async function fetchLoans(filters?: LoanQueryFilters): Promise<LoansPaginatedResult> {
  const page = filters?.page;
  const paginated = typeof page === "number";

  let query = supabase
    .from("loans")
    .select(
      "*, borrowers(first_name, last_name, email)",
      { count: paginated ? "exact" : undefined },
    )
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.loanType?.trim()) query = query.eq("loan_type", filters.loanType.trim());
  if (filters?.dataSource?.trim()) query = query.eq("data_source", filters.dataSource.trim());
  if (filters?.hideDemo) {
    query = query.not("data_source", "in", demoLoanSourcesInList());
  }
  if (filters?.search?.trim()) {
    const term = filters.search.trim();
    const borrowerIds = await fetchBorrowerIdsByName(term);
    if (borrowerIds.length > 0) {
      query = query.or(
        `loan_number.ilike.%${term}%,borrower_id.in.(${borrowerIds.join(",")})`,
      );
    } else {
      query = query.ilike("loan_number", `%${term}%`);
    }
  }

  if (paginated) {
    const from = (page - 1) * LOANS_PAGE_SIZE;
    const to = from + LOANS_PAGE_SIZE - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const analysisMap = await fetchLatestAnalysesMap();
  let rows = (data ?? []) as Record<string, unknown>[];
  rows = rows.map((row) => {
    const analysis = analysisMap.get(row.id as string);
    return {
      ...row,
      latest_risk_analysis: analysis ?? null,
    } as Loan;
  });

  if (filters?.riskLevel?.trim()) {
    const level = filters.riskLevel.trim().toLowerCase();
    rows = rows.filter(
      (r) => r.latest_risk_analysis?.risk_level?.toLowerCase() === level && !r.latest_risk_analysis?.is_outdated,
    );
  }

  return { rows: rows as Loan[], totalCount: count ?? rows.length };
}

export function useLoans(filters?: {
  search?: string;
  status?: string;
  loanType?: string;
  riskLevel?: string;
  page?: number;
}) {
  const hideDemo = useHideDemoData();
  return useQuery({
    queryKey: queryKeys.loans.list({
      search: filters?.search,
      status: filters?.status,
      loanType: filters?.loanType,
      riskLevel: filters?.riskLevel,
      page: filters?.page,
      hideDemo,
    }),
    queryFn: () => fetchLoans({ ...filters, hideDemo }),
  });
}

export function useLoansBySource(source: string, filters?: { page?: number; search?: string; status?: string }) {
  const hideDemo = useHideDemoData();
  return useQuery({
    queryKey: ["loans-by-source", source, filters?.page ?? null, filters?.search ?? "", filters?.status ?? "", hideDemo],
    queryFn: () => fetchLoans({ ...filters, dataSource: source, hideDemo }),
    enabled: Boolean(source?.trim()),
  });
}

export function useLoan(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.loans.detail(id ?? ""),
    queryFn: async (): Promise<Loan | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("loans")
        .select("*, borrowers(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Loan;
    },
    enabled: !!id,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoanInsert) => {
      const { data: { user } } = await supabase.auth.getUser();

      let branchId = input.branch_id ?? null;
      if (!branchId && user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("branch_id")
          .eq("id", user.id)
          .single();
        branchId = profile?.branch_id ?? null;
      }

      const { data, error } = await supabase
        .from("loans")
        .insert({
          loan_number: input.loan_number || "",
          borrower_id: input.borrower_id,
          loan_officer_id: input.loan_officer_id,
          product_id: input.product_id,
          program_id: input.program_id,
          branch_id: branchId,
          status: input.status ?? "draft",
          loan_amount: input.loan_amount,
          appraised_value: input.appraised_value,
          ltv: input.ltv,
          credit_score: input.credit_score,
          dti: input.dti,
          loan_type: input.loan_type,
          interest_rate: input.interest_rate,
          annual_income: input.annual_income,
          monthly_debt: input.monthly_debt,
          employment_years: input.employment_years,
          down_payment: input.down_payment,
          loan_term_months: input.loan_term_months,
          purpose: input.purpose,
          occupancy_type: input.occupancy_type,
          property_address: input.property_address,
          property_city: input.property_city,
          property_state: input.property_state,
          property_postal_code: input.property_postal_code,
          lock_date: input.lock_date,
          lock_expiration_date: input.lock_expiration_date,
          data_source: input.data_source,
          external_id: input.external_id,
          api_payload: input.api_payload,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Loan;
    },
    onSuccess: (createdLoan) => {
      invalidateKeys.loans(queryClient);
      logCrud("create", "loan", createdLoan.id, { loan_number: createdLoan.loan_number });
      toast.success("Loan created");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<LoanInsert>;
      silent?: boolean;
    }) => {
      const { data: out, error } = await supabase
        .from("loans")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return out as Loan;
    },
    onSuccess: (updatedLoan, variables) => {
      invalidateKeys.loans(queryClient);
      logCrud("update", "loan", updatedLoan.id, { loan_number: updatedLoan.loan_number });
      if (!variables.silent) toast.success("Loan updated");
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });
}

export interface LoanProduct {
  id: string;
  product_name: string;
  product_type: string;
  term_months: number;
  rate_type: string;
  is_active: boolean;
}

export interface LoanProgram {
  id: string;
  product_id: string;
  program_code: string;
  program_name: string;
  is_active: boolean;
}

export function useLoanProducts() {
  return useQuery({
    queryKey: ["loan_products"] as const,
    queryFn: async (): Promise<LoanProduct[]> => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, product_name, product_type, term_months, rate_type, is_active")
        .eq("is_active", true)
        .order("product_name");
      // Lite DBs may omit tables or RLS may differ — keep loan form usable with empty product list
      if (error) {
        console.warn("[useLoanProducts]", error.message);
        return [];
      }
      return (data ?? []) as LoanProduct[];
    },
  });
}

export function useLoanPrograms(productId?: string | null) {
  return useQuery({
    queryKey: ["loan_programs", productId] as const,
    queryFn: async (): Promise<LoanProgram[]> => {
      let query = supabase
        .from("loan_programs")
        .select("id, product_id, program_code, program_name, is_active")
        .eq("is_active", true)
        .order("program_name");
      if (productId) query = query.eq("product_id", productId);
      const { data, error } = await query;
      if (error) {
        console.warn("[useLoanPrograms]", error.message);
        return [];
      }
      return (data ?? []) as LoanProgram[];
    },
    enabled: true,
  });
}
