/**
 * calculate-loan-risk edge function
 *
 * Calculates risk scores for a loan based on:
 *   - lock_expiry_risk  : how close the rate lock is to expiring
 *   - condition_risk    : how many conditions are still open
 *   - stall_risk        : how long since the last timeline event
 *
 * Reads SLA thresholds from the sla_configurations table (falls back to defaults).
 * Upserts one row per loan into loan_risk_scores.
 * Creates loan_risk_alerts for high/critical risks, SLA breaches, and lock expiry warnings.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_LOCK_WARNING_HOURS = 168;
const DEFAULT_STALL_TARGET_HOURS = 72;

interface SLAConfig {
  name: string;
  scope: string;
  from_status: string | null;
  to_status: string | null;
  target_hours: number;
  warning_hours: number | null;
  severity: string;
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

function calcLockExpiryRisk(lockExpirationDate: string | null, warningHours: number): number {
  if (!lockExpirationDate) return 0;

  const now = Date.now();
  const expiry = new Date(lockExpirationDate).getTime();
  const hoursRemaining = (expiry - now) / (1000 * 60 * 60);

  if (hoursRemaining <= 0) return 100;

  const score = ((warningHours - hoursRemaining) / warningHours) * 100;
  return clamp(score);
}

function calcConditionRisk(conditions: Array<{ condition_type: string; status: string }>): number {
  const typeWeight: Record<string, number> = { PTD: 15, PTF: 10, PTC: 8 };
  const openStatuses = new Set(['pending', 'received']);

  const score = conditions
    .filter((c) => openStatuses.has(c.status))
    .reduce((acc, c) => acc + (typeWeight[c.condition_type] ?? 8), 0);

  return clamp(score);
}

function calcStallRisk(lastEventAt: string | null, stallTargetHours: number): number {
  if (!lastEventAt) return 50;

  const hoursSinceEvent = (Date.now() - new Date(lastEventAt).getTime()) / (1000 * 60 * 60);

  const score = (hoursSinceEvent / stallTargetHours) * 100;
  return clamp(score);
}

function scoreToLevel(score: number): string {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}

async function fetchSLAConfigs(supabase: any): Promise<SLAConfig[]> {
  const { data, error } = await supabase
    .from('sla_configurations')
    .select('name, scope, from_status, to_status, target_hours, warning_hours, severity')
    .eq('is_active', true);

  if (error) {
    console.warn('Could not fetch SLA configs, using defaults:', error.message);
    return [];
  }
  return data || [];
}

function getSLAThresholds(configs: SLAConfig[]) {
  const lockWarning = configs.find(c => c.scope === 'milestone' && c.name === 'Lock Expiry Warning');
  const uwTurnTime = configs.find(c => c.scope === 'stage_transition' && c.from_status === 'submitted_to_uw');

  return {
    lockWarningHours: lockWarning?.target_hours ?? DEFAULT_LOCK_WARNING_HOURS,
    stallTargetHours: uwTurnTime?.target_hours ?? DEFAULT_STALL_TARGET_HOURS,
  };
}

interface AlertInput {
  loan_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

async function createAlerts(supabase: any, alerts: AlertInput[]) {
  if (alerts.length === 0) return;

  const { error } = await supabase.from('loan_risk_alerts').insert(alerts);
  if (error) {
    console.error('Failed to create risk alerts:', error.message);
  }
}

function buildAlerts(
  loan: { id: string; lock_expiration_date: string | null; status: string; loan_number?: string },
  overallScore: number,
  riskLevel: string,
  lockExpiryRisk: number,
  conditionRisk: number,
  stallRisk: number,
  slaConfigs: SLAConfig[],
): AlertInput[] {
  const alerts: AlertInput[] = [];
  const loanLabel = loan.loan_number || loan.id.slice(0, 8);

  if (riskLevel === 'critical') {
    alerts.push({
      loan_id: loan.id,
      alert_type: 'critical_risk',
      severity: 'critical',
      title: `Critical risk on ${loanLabel}`,
      message: `Overall risk score reached ${overallScore}/100. Immediate attention required.`,
      metadata: { overall_risk_score: overallScore },
    });
  } else if (riskLevel === 'high') {
    alerts.push({
      loan_id: loan.id,
      alert_type: 'high_risk',
      severity: 'high',
      title: `High risk on ${loanLabel}`,
      message: `Overall risk score is ${overallScore}/100. Review recommended.`,
      metadata: { overall_risk_score: overallScore },
    });
  }

  if (lockExpiryRisk >= 70 && loan.lock_expiration_date) {
    const hoursRemaining = (new Date(loan.lock_expiration_date).getTime() - Date.now()) / (1000 * 60 * 60);
    const daysRemaining = Math.max(0, Math.round(hoursRemaining / 24));
    alerts.push({
      loan_id: loan.id,
      alert_type: 'lock_expiry',
      severity: hoursRemaining <= 0 ? 'critical' : 'high',
      title: hoursRemaining <= 0
        ? `Rate lock EXPIRED on ${loanLabel}`
        : `Rate lock expiring in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} — ${loanLabel}`,
      message: hoursRemaining <= 0
        ? 'The rate lock has expired. Re-lock or renegotiate immediately.'
        : `Rate lock expires ${new Date(loan.lock_expiration_date).toLocaleDateString()}. Ensure closing is on track.`,
      metadata: { lock_expiration_date: loan.lock_expiration_date, hours_remaining: Math.round(hoursRemaining) },
    });
  }

  if (stallRisk >= 70) {
    alerts.push({
      loan_id: loan.id,
      alert_type: 'stall',
      severity: stallRisk >= 90 ? 'critical' : 'high',
      title: `Pipeline stall detected — ${loanLabel}`,
      message: 'No activity for an extended period. Check if the loan is blocked.',
      metadata: { stall_risk: stallRisk },
    });
  }

  const stageTransitions = slaConfigs.filter(c => c.scope === 'stage_transition');
  for (const sla of stageTransitions) {
    if (sla.from_status === loan.status) {
      alerts.push({
        loan_id: loan.id,
        alert_type: 'sla_warning',
        severity: sla.severity as string,
        title: `SLA: "${sla.name}" may breach — ${loanLabel}`,
        message: `Target: ${sla.target_hours}h. Loan is currently in "${loan.status}" stage.`,
        metadata: { sla_name: sla.name, target_hours: sla.target_hours },
      });
    }
  }

  return alerts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { loan_id } = body as { loan_id?: string };

    if (!loan_id) {
      return new Response(
        JSON.stringify({ error: 'loan_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const [loanResult, conditionsResult, recentEventsResult, slaConfigs] = await Promise.all([
      supabase.from('loans').select('id, loan_number, lock_expiration_date, status').eq('id', loan_id).single(),
      supabase.from('loan_conditions').select('condition_type, status').eq('loan_id', loan_id),
      supabase
        .from('loan_timeline_events')
        .select('occurred_at')
        .eq('loan_id', loan_id)
        .order('occurred_at', { ascending: false })
        .limit(1),
      fetchSLAConfigs(supabase),
    ]);

    const loan = loanResult.data;
    if (loanResult.error || !loan) {
      return new Response(
        JSON.stringify({ error: 'Loan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const lastEventAt = recentEventsResult.data?.[0]?.occurred_at ?? null;
    const { lockWarningHours, stallTargetHours } = getSLAThresholds(slaConfigs);

    const lock_expiry_risk = calcLockExpiryRisk(loan.lock_expiration_date, lockWarningHours);
    const condition_risk = calcConditionRisk(conditionsResult.data ?? []);
    const stall_risk = calcStallRisk(lastEventAt, stallTargetHours);

    const overall_risk_score = clamp(
      lock_expiry_risk * 0.4 + condition_risk * 0.35 + stall_risk * 0.25,
    );
    const risk_level = scoreToLevel(overall_risk_score);

    const risk_factors: Array<{ type: string; description: string; weight: number }> = [];

    if (lock_expiry_risk > 0) {
      risk_factors.push({
        type: 'lock_expiry',
        description: loan.lock_expiration_date
          ? `Rate lock expires ${new Date(loan.lock_expiration_date).toLocaleDateString()}`
          : 'Rate lock expiration unknown',
        weight: lock_expiry_risk,
      });
    }
    if (condition_risk > 0) {
      const openCount = (conditionsResult.data ?? []).filter(
        (c) => c.status === 'pending' || c.status === 'received',
      ).length;
      risk_factors.push({
        type: 'open_conditions',
        description: `${openCount} open condition${openCount !== 1 ? 's' : ''} remaining`,
        weight: condition_risk,
      });
    }
    if (stall_risk > 30) {
      risk_factors.push({
        type: 'stall',
        description: lastEventAt
          ? `No activity since ${new Date(lastEventAt).toLocaleDateString()}`
          : 'No timeline activity recorded',
        weight: stall_risk,
      });
    }

    const { error: upsertError } = await supabase
      .from('loan_risk_scores')
      .upsert(
        {
          loan_id,
          overall_risk_score,
          risk_level,
          risk_factors,
          stall_risk,
          lock_expiry_risk,
          condition_risk,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'loan_id' },
      );

    if (upsertError) {
      console.error('Failed to upsert risk score:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save risk score', details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Generate risk alerts for high/critical situations ---
    if (risk_level === 'high' || risk_level === 'critical' || lock_expiry_risk >= 70 || stall_risk >= 70) {
      const alerts = buildAlerts(loan, overall_risk_score, risk_level, lock_expiry_risk, condition_risk, stall_risk, slaConfigs);
      await createAlerts(supabase, alerts);
    }

    return new Response(
      JSON.stringify({ loan_id, overall_risk_score, risk_level, risk_factors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
