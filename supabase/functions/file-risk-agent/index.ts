/**
 * File Risk Agent Edge Function
 * Rule-based pipeline risk analysis across loans, conditions, milestones, timeline, and SLA tables.
 * Designed to plug in AI narrative generation later when an OpenAI key is configured.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface RiskFactor {
  type: string;
  description: string;
  weight: number;
}

interface LoanRiskResult {
  loan_id: string;
  loan_number: string;
  borrower_name: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  overall_risk_score: number;
  stall_risk: number;
  lock_expiry_risk: number;
  condition_risk: number;
  milestone_risk: number;
  risk_factors: RiskFactor[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysDiff(dateStr: string | null | undefined, fromDate = new Date()): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function riskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

// ── Risk computations ──────────────────────────────────────────────────────────

function computeLockExpiryRisk(loan: Record<string, unknown>): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  const daysToExpiry = daysDiff(loan.lock_expiration_date as string | null);

  if (daysToExpiry === null) return { score: 0, factors };

  let score = 0;
  if (daysToExpiry < 0) {
    score = 100;
    factors.push({ type: 'lock_expiry', description: `Rate lock expired ${Math.abs(daysToExpiry)} day(s) ago`, weight: 50 });
  } else if (daysToExpiry <= 3) {
    score = 90;
    factors.push({ type: 'lock_expiry', description: `Rate lock expires in ${daysToExpiry} day(s) — urgent`, weight: 45 });
  } else if (daysToExpiry <= 7) {
    score = 70;
    factors.push({ type: 'lock_expiry', description: `Rate lock expires in ${daysToExpiry} days`, weight: 35 });
  } else if (daysToExpiry <= 14) {
    score = 40;
    factors.push({ type: 'lock_expiry', description: `Rate lock expires in ${daysToExpiry} days`, weight: 20 });
  }

  return { score, factors };
}

function computeStallRisk(
  loan: Record<string, unknown>,
  lastEventAt: string | null,
): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];

  // Use last timeline event or loan updated_at as the activity signal
  const activityDate = lastEventAt ?? (loan.updated_at as string | null);
  const daysSinceActivity = activityDate ? -daysDiff(activityDate)! : null;

  if (daysSinceActivity === null) return { score: 0, factors };

  let score = 0;
  if (daysSinceActivity >= 30) {
    score = 100;
    factors.push({ type: 'stall', description: `No activity in ${daysSinceActivity} days — severely stalled`, weight: 50 });
  } else if (daysSinceActivity >= 14) {
    score = 75;
    factors.push({ type: 'stall', description: `No activity in ${daysSinceActivity} days — stalled`, weight: 38 });
  } else if (daysSinceActivity >= 7) {
    score = 40;
    factors.push({ type: 'stall', description: `No activity in ${daysSinceActivity} days`, weight: 20 });
  }

  return { score, factors };
}

function computeConditionRisk(conditions: Record<string, unknown>[]): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  if (!conditions.length) return { score: 0, factors };

  const pending = conditions.filter(c => c.status === 'pending' || c.status === 'open');
  const overdue = pending.filter(c => {
    const days = daysDiff(c.due_date as string | null);
    return days !== null && days < 0;
  });

  const ptd = pending.filter(c => c.condition_type === 'PTD');
  const ptf = pending.filter(c => c.condition_type === 'PTF');
  const ptc = pending.filter(c => c.condition_type === 'PTC');

  let score = 0;

  if (overdue.length > 0) {
    score += Math.min(40, overdue.length * 15);
    factors.push({ type: 'overdue_conditions', description: `${overdue.length} overdue condition(s)`, weight: Math.min(40, overdue.length * 15) });
  }
  if (ptd.length > 0) {
    score += Math.min(30, ptd.length * 8);
    factors.push({ type: 'pending_conditions', description: `${ptd.length} pending PTD condition(s)`, weight: Math.min(30, ptd.length * 8) });
  }
  if (ptf.length > 0) {
    score += Math.min(20, ptf.length * 6);
    factors.push({ type: 'pending_conditions', description: `${ptf.length} pending PTF condition(s)`, weight: Math.min(20, ptf.length * 6) });
  }
  if (ptc.length > 0) {
    score += Math.min(15, ptc.length * 5);
    factors.push({ type: 'pending_conditions', description: `${ptc.length} pending PTC condition(s)`, weight: Math.min(15, ptc.length * 5) });
  }

  return { score: clamp(score), factors };
}

function computeMilestoneRisk(milestones: Record<string, unknown>[]): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  if (!milestones.length) return { score: 0, factors };

  const incomplete = milestones.filter(m => m.status !== 'completed' && m.status !== 'skipped');
  const overdue = incomplete.filter(m => {
    const days = daysDiff(m.due_date as string | null);
    return days !== null && days < 0;
  });

  let score = 0;
  if (overdue.length > 0) {
    score = Math.min(80, overdue.length * 20);
    const names = overdue
      .map(m => m.milestone_name ?? m.name ?? 'Milestone')
      .slice(0, 2)
      .join(', ');
    factors.push({ type: 'milestone_overdue', description: `Overdue milestone(s): ${names}`, weight: score });
  }

  return { score: clamp(score), factors };
}

function computeCreditRisk(loan: Record<string, unknown>): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  const dti = loan.dti as number | null;
  const ltv = loan.ltv as number | null;
  const creditScore = loan.credit_score as number | null;

  if (dti !== null && dti > 43) {
    const excess = Math.round(dti - 43);
    score += Math.min(30, excess * 5);
    factors.push({ type: 'credit', description: `DTI at ${dti.toFixed(1)}% (>${43}% guideline)`, weight: Math.min(30, excess * 5) });
  }
  if (ltv !== null && ltv > 80) {
    const excess = Math.round(ltv - 80);
    score += Math.min(20, excess * 3);
    factors.push({ type: 'credit', description: `LTV at ${ltv.toFixed(1)}% (requires PMI)`, weight: Math.min(20, excess * 3) });
  }
  if (creditScore !== null && creditScore < 640) {
    score += 25;
    factors.push({ type: 'credit', description: `Credit score ${creditScore} — below standard threshold`, weight: 25 });
  }

  return { score: clamp(score), factors };
}

// ── Main loan analysis ─────────────────────────────────────────────────────────

async function analyzeLoan(
  supabase: ReturnType<typeof createClient>,
  loanId: string,
): Promise<LoanRiskResult | null> {
  // Fetch all needed data in parallel
  const [loanRes, conditionsRes, milestonesRes, timelineRes] = await Promise.all([
    supabase
      .from('loans')
      .select('*, borrowers(first_name, last_name)')
      .eq('id', loanId)
      .single(),
    supabase
      .from('loan_conditions')
      .select('*')
      .eq('loan_id', loanId),
    supabase
      .from('loan_milestones')
      .select('*')
      .eq('loan_id', loanId),
    supabase
      .from('loan_timeline_events')
      .select('created_at')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  if (loanRes.error || !loanRes.data) {
    console.error(`Failed to fetch loan ${loanId}:`, loanRes.error);
    return null;
  }

  const loan = loanRes.data as Record<string, unknown>;
  const conditions = (conditionsRes.data ?? []) as Record<string, unknown>[];
  const milestones = (milestonesRes.data ?? []) as Record<string, unknown>[];
  const lastEventAt = (timelineRes.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null;

  // Compute sub-scores
  const lockResult = computeLockExpiryRisk(loan);
  const stallResult = computeStallRisk(loan, lastEventAt);
  const conditionResult = computeConditionRisk(conditions);
  const milestoneResult = computeMilestoneRisk(milestones);
  const creditResult = computeCreditRisk(loan);

  // Weighted overall score
  // Lock: 30%, Stall: 25%, Conditions: 25%, Milestone: 15%, Credit: 5%
  const overall = clamp(
    Math.round(
      lockResult.score * 0.30 +
      stallResult.score * 0.25 +
      conditionResult.score * 0.25 +
      milestoneResult.score * 0.15 +
      creditResult.score * 0.05,
    ),
  );

  const allFactors = [
    ...lockResult.factors,
    ...stallResult.factors,
    ...conditionResult.factors,
    ...milestoneResult.factors,
    ...creditResult.factors,
  ].sort((a, b) => b.weight - a.weight);

  const borrower = loan.borrowers as { first_name?: string; last_name?: string } | null;
  const borrowerName = borrower
    ? [borrower.first_name, borrower.last_name].filter(Boolean).join(' ')
    : 'Unknown';

  return {
    loan_id: loanId,
    loan_number: (loan.loan_number as string) ?? '',
    borrower_name: borrowerName,
    risk_level: riskLevel(overall),
    overall_risk_score: overall,
    stall_risk: stallResult.score,
    lock_expiry_risk: lockResult.score,
    condition_risk: conditionResult.score,
    milestone_risk: milestoneResult.score,
    risk_factors: allFactors,
  };
}

// ── Edge function handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  console.log('file-risk-agent invoked:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    console.log('env check — url:', !!supabaseUrl, 'anon key:', !!supabaseAnonKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build user-scoped client so RLS is respected
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    // Validate session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedIds: string[] | undefined = body.loan_ids;

    // Resolve which loan IDs to analyze
    let loanIds: string[];
    if (requestedIds && requestedIds.length > 0) {
      loanIds = requestedIds;
    } else {
      // All accessible loans (RLS filters by role)
      const { data, error } = await supabase
        .from('loans')
        .select('id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      loanIds = (data ?? []).map((r: { id: string }) => r.id);
    }

    if (loanIds.length === 0) {
      return new Response(
        JSON.stringify({ results: [], analyzed_at: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Analyze each loan (sequential to avoid rate-limiting DB)
    const results: LoanRiskResult[] = [];
    for (const id of loanIds) {
      const result = await analyzeLoan(supabase, id);
      if (result) results.push(result);
    }

    // Upsert risk scores back to loan_risk_scores
    const upsertRows = results.map(r => ({
      loan_id: r.loan_id,
      overall_risk_score: r.overall_risk_score,
      risk_level: r.risk_level,
      stall_risk: r.stall_risk,
      lock_expiry_risk: r.lock_expiry_risk,
      condition_risk: r.condition_risk,
      risk_factors: r.risk_factors,
      calculated_at: new Date().toISOString(),
    }));

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('loan_risk_scores')
        .upsert(upsertRows, { onConflict: 'loan_id' });
      if (upsertError) {
        console.error('Failed to upsert risk scores:', upsertError);
        // Non-fatal — still return results
      }
    }

    return new Response(
      JSON.stringify({ results, analyzed_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('File Risk Agent error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
