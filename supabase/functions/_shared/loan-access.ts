/**
 * Shared loan access checks for Mortgage Risk Copilot edge functions.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeRole as normRole } from "./ai-utils.ts";

export type LoanAccessResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function assertLoanOfficerAccess(
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
  userId: string,
  loanId: string,
): Promise<LoanAccessResult> {
  const { data: roleRows } = await userClient.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((roleRows ?? []).map((r: { role: string }) => normRole(r.role)));

  const { data: prof } = await serviceClient
    .from("profiles")
    .select("role, branch_id")
    .eq("id", userId)
    .maybeSingle();
  if (prof?.role) roles.add(normRole(prof.role as string));

  if (roles.has("admin") || roles.has("moderator")) {
    return { ok: true };
  }

  const { data: loan, error } = await serviceClient
    .from("loans")
    .select("loan_officer_id, branch_id")
    .eq("id", loanId)
    .maybeSingle();

  if (error || !loan) {
    return { ok: false, status: 404, message: "Loan not found" };
  }

  if (loan.loan_officer_id === userId) {
    return { ok: true };
  }

  if (roles.has("branch_manager") && prof?.branch_id && loan.branch_id === prof.branch_id) {
    return { ok: true };
  }

  return { ok: false, status: 403, message: "You do not have access to this loan." };
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase configuration");
  }
  return createClient(supabaseUrl, serviceKey);
}
