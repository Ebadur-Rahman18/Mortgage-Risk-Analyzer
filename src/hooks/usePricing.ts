import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { logCrud } from "@/lib/activity-logger";

export interface RateSheet {
  id: string;
  name: string;
  source_type: "upload" | "datastore";
  effective_date: string | null;
  expiration_date: string | null;
  created_by: string | null;
  created_at: string;
  status: "active" | "archived";
  datastore_source_id: string | null;
  metadata: Record<string, unknown>;
}

export interface RateSheetDatastore {
  id: string;
  provider_name: string;
  connection_type: "csv_import" | "external_tool";
  integration_notes: string | null;
  created_by: string | null;
  created_at: string;
  status: "active" | "disabled";
}

export interface PricingResult {
  rate_sheet_id: string;
  rate_sheet_name?: string;
  investor_code?: string | null;
  product_name: string;
  loan_type: string | null;
  state: string;
  base_rate: number;
  base_price: number | null;
  adjusted_rate: number;
  adjusted_price: number | null;
  eligibility_status: string;
  eligibility_message: string;
  quote_type?: string;
  simulations: {
    lock_term_days: number;
    est_rate: number;
    est_price: number | null;
  }[];
}

export interface PricingDiagnostics {
  normalized_state: string;
  active_rate_sheet_name: string;
  total_products_in_sheet?: number;
  total_products_considered?: number;
  considered_products: number;
  eligible_products: number;
  ineligible_products: number;
  best_execution?: boolean;
}

export interface PricingCalculationResponse {
  rate_sheet: RateSheet;
  rate_sheets_considered?: Array<{ id: string; name: string; investor_code?: string | null }>;
  results: PricingResult[];
  scenario_dims?: Record<string, unknown>;
  diagnostics?: PricingDiagnostics;
  message?: string;
}

export interface RateLockHistoryResponse {
  locks: Record<string, unknown>[];
  history: Record<string, unknown>[];
}

export function useRateSheets() {
  return useQuery({
    queryKey: queryKeys.pricing.rateSheets.all,
    queryFn: async (): Promise<RateSheet[]> => {
      const { data, error } = await supabase
        .from("rate_sheets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RateSheet[];
    },
  });
}

export function useActiveRateSheet() {
  return useQuery({
    queryKey: queryKeys.pricing.rateSheets.active,
    queryFn: async (): Promise<RateSheet | null> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("rate_sheets")
        .select("*")
        .eq("status", "active")
        .lte("effective_date", today)
        .gte("expiration_date", today)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data as RateSheet) ?? null;
    },
  });
}

export function useRateSheetDatastores() {
  return useQuery({
    queryKey: queryKeys.pricing.datastores.all,
    queryFn: async (): Promise<RateSheetDatastore[]> => {
      const { data, error } = await supabase
        .from("rate_sheet_datastores")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RateSheetDatastore[];
    },
  });
}

export function usePricingCalculator() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      loan_amount: number;
      property_value?: number;
      credit_score: number;
      state: string;
      product_type?: string;
      lock_term_days?: number;
      loan_id?: string;
      include_ineligible?: boolean;
      occupancy_type?: string | null;
      purpose?: string | null;
      property_type?: string | null;
      first_time_homebuyer?: boolean | null;
      subordinate_financing?: boolean | null;
      investor_code?: string | null;
      rate_sheet_id?: string | null;
      best_execution?: boolean;
    }): Promise<PricingCalculationResponse> => {
      const { data, error } = await supabase.functions.invoke("pricing-calculate", {
        body: {
          ...payload,
          user_id: user?.id,
        },
        headers: { "Content-Type": "application/json" },
      });
      if (error) {
        const shouldRetryWithDirectFetch =
          typeof error.message === "string" &&
          error.message.toLowerCase().includes("non-2xx");

        if (!shouldRetryWithDirectFetch) throw error;

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        const directClient = createClient<Database>(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: retryData, error: retryError } = await directClient.functions.invoke(
          "pricing-calculate",
          {
            body: {
              ...payload,
              user_id: user?.id,
            },
            headers: { "Content-Type": "application/json" },
          },
        );

        if (retryError) throw retryError;
        return retryData as PricingCalculationResponse;
      }
      return data as PricingCalculationResponse;
    },
  });
}

export function useRateLocksByLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pricing.locks.byLoan(loanId ?? ""),
    queryFn: async (): Promise<RateLockHistoryResponse> => {
      if (!loanId) return { locks: [], history: [] };
      const { data, error } = await supabase.functions.invoke("rate-locks", {
        body: { action: "history", loan_id: loanId },
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw error;
      return data as RateLockHistoryResponse;
    },
    enabled: !!loanId,
  });
}

export interface RateLockRow {
  id: string;
  loan_id: string;
  product_name: string | null;
  locked_rate: number | null;
  lock_date: string | null;
  lock_expiration: string | null;
  status: string | null;
  investor_code?: string | null;
  source?: string | null;
}

/** Active / recent locks visible under RLS (branch / LO scope). */
export function useRateLocksInScope() {
  return useQuery({
    queryKey: queryKeys.pricing.locks.scoped,
    queryFn: async (): Promise<RateLockRow[]> => {
      const { data, error } = await supabase
        .from("rate_locks")
        .select(
          "id, loan_id, product_name, locked_rate, lock_date, lock_expiration, status, investor_code, source",
        )
        .in("status", ["active", "extended", "relocked"])
        .order("lock_expiration", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as RateLockRow[];
    },
    staleTime: 30_000,
  });
}

export function useRateLockActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      action: "create" | "extend" | "relock";
      loan_id?: string;
      product_name?: string;
      locked_rate?: number;
      lock_term_days?: number;
      rate_lock_id?: string;
      extension_days?: number;
      new_rate?: number;
      rate_sheet_id?: string | null;
      investor_code?: string | null;
      price_at_lock?: number | null;
      source?: "manual" | "pricing_quote";
    }) => {
      const { data, error } = await supabase.functions.invoke("rate-locks", {
        body: { ...payload, user_id: user?.id },
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      return data as { lock?: Record<string, unknown> };
    },
    onSuccess: (response, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pricing.locks.scoped });
      if (vars.loan_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.pricing.locks.byLoan(vars.loan_id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(vars.loan_id) });
      }
      if (vars.rate_lock_id) {
        queryClient.invalidateQueries({ queryKey: ["pricing", "locks"] });
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      }
      invalidateKeys.managerDashboard(queryClient);
      const lockId = response?.lock?.id;
      if (typeof lockId === "string") {
        logCrud("create", "rate_lock", lockId, {
          action: vars.action,
          loan_id: vars.loan_id ?? null,
        });
      }
    },
  });
}

export function pickWinnerPricingResult(results: PricingResult[]): PricingResult | null {
  if (!results?.length) return null;
  const rank = (s: string) => (s === "Eligible" ? 0 : s === "EligibleWithConditions" ? 1 : 2);
  const eligible = results.filter((r) => r.eligibility_status !== "Not Eligible");
  const pool = eligible.length ? eligible : results;
  return [...pool].sort((a, b) => {
    const rc = rank(a.eligibility_status) - rank(b.eligibility_status);
    if (rc !== 0) return rc;
    return a.adjusted_rate - b.adjusted_rate;
  })[0];
}

export interface LoanPricingSnapshotRow {
  id: string;
  loan_id: string;
  computed_at: string;
  best_execution: boolean;
  winner_investor_code: string | null;
  winner_product_name: string | null;
  winner_rate: number | null;
  winner_price: number | null;
  winner_quote_type: string | null;
  results_count: number | null;
  raw_summary?: Record<string, unknown> | null;
}

export function useLoanPricingSnapshot(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pricing.pricingSnapshot(loanId ?? ""),
    queryFn: async (): Promise<LoanPricingSnapshotRow | null> => {
      if (!loanId) return null;
      const { data, error } = await supabase
        .from("loan_pricing_snapshots")
        .select(
          "id, loan_id, computed_at, best_execution, winner_investor_code, winner_product_name, winner_rate, winner_price, winner_quote_type, results_count, raw_summary",
        )
        .eq("loan_id", loanId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data as LoanPricingSnapshotRow) ?? null;
    },
    enabled: !!loanId,
  });
}

export function useSaveLoanPricingSnapshot() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (vars: {
      loanId: string;
      bestExecution: boolean;
      results: PricingResult[];
      scenario_dims?: Record<string, unknown>;
      diagnostics?: PricingDiagnostics | null;
      rateSheetsConsidered?: Array<{ id: string; name: string; investor_code?: string | null }>;
    }) => {
      const winner = pickWinnerPricingResult(vars.results);
      const { error } = await supabase.from("loan_pricing_snapshots").insert({
        loan_id: vars.loanId,
        computed_by: user?.id ?? null,
        best_execution: vars.bestExecution,
        winner_investor_code: winner?.investor_code ?? null,
        winner_product_name: winner?.product_name ?? null,
        winner_rate: winner?.adjusted_rate ?? null,
        winner_price: winner?.adjusted_price ?? null,
        winner_quote_type: winner?.quote_type ?? null,
        results_count: vars.results.length,
        scenario_dims: vars.scenario_dims ?? {},
        raw_summary: {
          diagnostics: vars.diagnostics ?? null,
          rate_sheets_considered: vars.rateSheetsConsidered ?? null,
          last_results: vars.results,
        },
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pricing.pricingSnapshot(vars.loanId) });
      logCrud("create", "pipeline", vars.loanId, {
        best_execution: vars.bestExecution,
        results_count: vars.results.length,
      });
    },
  });
}

