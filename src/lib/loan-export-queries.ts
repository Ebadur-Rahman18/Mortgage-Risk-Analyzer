// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { supabase } from "@/lib/supabase";
import type { Loan } from "@/hooks/useLoans";
import type { PipelineExportLoan } from "@/lib/loan-export-utils";
import { demoLoanSourcesInList } from "@/lib/demoData";

/**
 * Loads loans visible under RLS with borrower join and risk_level from loan_risk_scores.
 */
export async function fetchPipelineLoansWithRisk(filters?: {
  search?: string;
  status?: string;
  hideDemo?: boolean;
}): Promise<PipelineExportLoan[]> {
  let query = supabase
    .from("loans")
    .select("*, borrowers(first_name, last_name, email)")
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.hideDemo) {
    query = query.not("data_source", "in", demoLoanSourcesInList());
  }
  if (filters?.search?.trim()) {
    query = query.ilike("loan_number", `%${filters.search.trim()}%`);
  }

  const { data: loans, error } = await query;
  if (error) throw error;
  const list = (loans ?? []) as Loan[];
  if (list.length === 0) return [];

  const ids = list.map((l) => l.id);
  const { data: scores, error: scoreError } = await supabase
    .from("loan_risk_scores")
    .select("loan_id, risk_level")
    .in("loan_id", ids);
  if (scoreError) throw scoreError;

  const map = new Map<string, string>();
  for (const s of scores ?? []) {
    const row = s as { loan_id: string; risk_level: string };
    map.set(row.loan_id, row.risk_level);
  }

  const { data: snapRows, error: snapError } = await supabase
    .from("loan_pricing_snapshots")
    .select("loan_id, winner_investor_code, computed_at")
    .in("loan_id", ids)
    .order("computed_at", { ascending: false });
  if (snapError) throw snapError;

  const investorByLoan = new Map<string, string | null>();
  for (const row of snapRows ?? []) {
    const r = row as { loan_id: string; winner_investor_code: string | null };
    if (!investorByLoan.has(r.loan_id)) {
      investorByLoan.set(r.loan_id, r.winner_investor_code ?? null);
    }
  }

  return list.map((l) => ({
    ...l,
    risk_level: map.get(l.id) ?? null,
    pricing_investor_code: investorByLoan.get(l.id) ?? null,
  }));
}
