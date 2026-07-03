import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function assertStaffCanAccessLoan(
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
  userId: string,
  loanId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { data: roleRows } = await userClient.from('user_roles').select('role').eq('user_id', userId);
  const roles = new Set((roleRows ?? []).map((r: { role: string }) => r.role));
  if (roles.has('admin') || roles.has('moderator')) return { ok: true };

  const { data: loan, error } = await serviceClient
    .from('loans')
    .select('loan_officer_id, branch_id')
    .eq('id', loanId)
    .maybeSingle();

  if (error || !loan) return { ok: false, status: 404, message: 'Loan not found' };
  if (loan.loan_officer_id === userId) return { ok: true };

  if (roles.has('branch_manager')) {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('branch_id')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.branch_id && loan.branch_id === profile.branch_id) return { ok: true };
  }

  return { ok: false, status: 403, message: 'You do not have access to this loan.' };
}

/** Normalise role strings for comparison (matches src/lib/agentRoles.ts). */
function normRole(r: string): string {
  return r.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Compliance screening is oversight-only: admin, moderator, or branch manager
 * (branch-matched loan). Loan officers and other roles are denied even if they
 * can access the loan for other workflows.
 */
export async function assertComplianceScreeningAccess(
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
  userId: string,
  loanId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { data: roleRows } = await userClient.from('user_roles').select('role').eq('user_id', userId);
  const roles = new Set((roleRows ?? []).map((r: { role: string }) => normRole(r.role)));

  const { data: prof } = await serviceClient
    .from('profiles')
    .select('role, branch_id')
    .eq('id', userId)
    .maybeSingle();
  if (prof?.role) roles.add(normRole(prof.role as string));

  if (roles.has('admin') || roles.has('moderator')) {
    return { ok: true };
  }

  if (roles.has('branch_manager')) {
    const { data: loan, error } = await serviceClient
      .from('loans')
      .select('branch_id')
      .eq('id', loanId)
      .maybeSingle();
    if (error || !loan) return { ok: false, status: 404, message: 'Loan not found' };
    if (prof?.branch_id && loan.branch_id === prof.branch_id) {
      return { ok: true };
    }
    return {
      ok: false,
      status: 403,
      message: 'You can only run compliance screening for loans in your branch.',
    };
  }

  return {
    ok: false,
    status: 403,
    message: 'Compliance screening is not available for your role.',
  };
}
