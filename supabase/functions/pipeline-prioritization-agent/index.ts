/**
 * pipeline-prioritization-agent — Scores & ranks open loans by urgency.
 * 1. Loads all open loans with risk scores, conditions, milestones, comms, timeline
 * 2. Computes deterministic sub-scores (SLA risk, lock expiry)
 * 3. Sends batch to OpenAI for engagement + close probability estimates
 * 4. Computes final urgency score, upserts pipeline_priority_scores
 * 5. Logs in ai_agent_runs
 *
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResp, parseAiArray, normalizeRole, logAgentRun, getUserPersonalizationPrompt, chatCompletion } from '../_shared/ai-utils.ts';

const AGENT_SLUG = 'pipeline-prioritization-agent';
const CLOSED_STATUSES = ['closed', 'cancelled', 'withdrawn', 'denied'];
const FULL_PIPELINE_ROLES = new Set(['admin', 'superadmin', 'branch_manager', 'moderator']);

/**
 * Structured output schema appended to every system prompt (L5).
 * Enforces JSON object mode (required by OpenAI response_format) with a "results" wrapper.
 */
const PIPELINE_OUTPUT_SCHEMA = `
You MUST respond with a valid JSON object in exactly this format — no other text:
{
  "results": [
    {
      "loan_id": "<uuid>",
      "engagement_score": <integer 0-100>,
      "close_probability": <integer 0-100>,
      "urgency_reason": "<one sentence, max 120 chars>",
      "engagement_note": "<one sentence about borrower engagement level>",
      "close_note": "<one sentence about close probability reasoning>"
    }
  ]
}
Include one object per loan in the same order as the input. Do not add extra fields.`;

interface LoanContext {
  loan_id: string;
  loan_number: string;
  status: string;
  loan_amount: number | null;
  dti: number | null;
  ltv: number | null;
  credit_score: number | null;
  lock_expiration_date: string | null;
  loan_officer_id: string | null;
  sla_risk_score: number;
  lock_expiry_risk: number;
  days_to_lock_expiry: number | null;
  conditions_pending: number;
  conditions_total: number;
  milestones_completed: number;
  milestones_total: number;
  recent_comms_count: number;
  last_timeline_event_days_ago: number | null;
  borrower_name: string | null;
}

interface AiResult {
  loan_id: string;
  engagement_score: number;
  close_probability: number;
  urgency_reason: string;
  engagement_note: string;
  close_note: string;
}

interface ExistingPriorityRow {
  loan_id: string;
  engagement_sub: number | null;
  close_probability_sub: number | null;
  urgency_reason: string | null;
  ai_engagement_note: string | null;
  ai_close_note: string | null;
  metadata: Record<string, unknown> | null;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function computeLockExpirySub(lockExpDate: string | null): { score: number; daysLeft: number | null } {
  if (!lockExpDate) return { score: 80, daysLeft: null };
  const now = Date.now();
  const exp = new Date(lockExpDate).getTime();
  const daysLeft = (exp - now) / (1000 * 60 * 60 * 24);
  if (daysLeft <= 0) return { score: 100, daysLeft: Math.round(daysLeft) };
  if (daysLeft <= 3) return { score: 90, daysLeft: Math.round(daysLeft) };
  if (daysLeft <= 7) return { score: 70, daysLeft: Math.round(daysLeft) };
  if (daysLeft <= 14) return { score: 40, daysLeft: Math.round(daysLeft) };
  return { score: 10, daysLeft: Math.round(daysLeft) };
}

function buildAiInputSnapshot(ctx: LoanContext): Record<string, unknown> {
  return {
    status: ctx.status,
    loan_amount: ctx.loan_amount,
    dti: ctx.dti,
    ltv: ctx.ltv,
    credit_score: ctx.credit_score,
    sla_risk_score: ctx.sla_risk_score,
    lock_expiry_risk: ctx.lock_expiry_risk,
    days_to_lock_expiry: ctx.days_to_lock_expiry,
    conditions_pending: ctx.conditions_pending,
    conditions_total: ctx.conditions_total,
    milestones_completed: ctx.milestones_completed,
    milestones_total: ctx.milestones_total,
    recent_comms_count: ctx.recent_comms_count,
    last_timeline_event_days_ago: ctx.last_timeline_event_days_ago,
  };
}

function snapshotsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: 'Missing Supabase configuration' }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as { user_id?: string; mode?: string };
    const isCron = body.mode === 'cron';

    let uid: string | null = null;
    let canRankFullPipeline = false;

    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResp({ error: 'Unauthorized' }, 401);
      }
      const jwt = authHeader.replace(/^Bearer\s+/i, '');
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
      if (userErr || !userData?.user) {
        return jsonResp({ error: 'Invalid session' }, 401);
      }
      uid = userData.user.id;

      const { data: roleData } = await userClient
        .from('user_roles')
        .select('role, custom_role_id')
        .eq('user_id', uid)
        .maybeSingle();

      let customRole = '';
      if (roleData?.custom_role_id) {
        const { data: customRoleData } = await userClient
          .from('roles')
          .select('name')
          .eq('id', roleData.custom_role_id)
          .maybeSingle();
        customRole = normalizeRole(customRoleData?.name);
      }

      const appRole = normalizeRole(roleData?.role);
      canRankFullPipeline =
        FULL_PIPELINE_ROLES.has(appRole) || FULL_PIPELINE_ROLES.has(customRole);
    }

    const service = createClient(supabaseUrl, serviceKey);

    const { data: agent } = await service
      .from('ai_agents')
      .select('id, system_prompt, is_enabled, provider_config')
      .eq('slug', AGENT_SLUG)
      .maybeSingle();

    if (!agent?.is_enabled) {
      return jsonResp({ error: 'Pipeline Prioritization Agent is disabled.' }, 400);
    }

    // Load open loans
    let loansQuery = service
      .from('loans')
      .select('id, loan_number, status, loan_amount, dti, ltv, credit_score, lock_expiration_date, loan_officer_id, borrower_id, borrowers(first_name, last_name)')
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
      .limit(500);

    if (!isCron && uid && !canRankFullPipeline) {
      loansQuery = loansQuery.eq('loan_officer_id', uid);
    }

    const { data: loans, error: loansErr } = await loansQuery;
    if (loansErr) {
      console.error('Loans query error:', loansErr);
      return jsonResp({ error: 'Failed to load loans' }, 500);
    }
    if (!loans || loans.length === 0) {
      return jsonResp({ message: 'No open loans to score', scored: 0 });
    }

    const loanIds = loans.map((l: Record<string, unknown>) => l.id as string);

    const { data: existingPriorityRows } = await service
      .from('pipeline_priority_scores')
      .select('loan_id, engagement_sub, close_probability_sub, urgency_reason, ai_engagement_note, ai_close_note, metadata')
      .in('loan_id', loanIds);

    const existingByLoan = new Map<string, ExistingPriorityRow>();
    for (const row of (existingPriorityRows ?? []) as ExistingPriorityRow[]) {
      existingByLoan.set(row.loan_id, row);
    }

    // Batch load related data
    const [riskRes, conditionsRes, milestonesRes, commsRes, timelineRes] = await Promise.all([
      service.from('loan_risk_scores').select('loan_id, overall_risk_score, lock_expiry_risk').in('loan_id', loanIds),
      service.from('loan_conditions').select('loan_id, status').in('loan_id', loanIds),
      service.from('loan_milestones').select('loan_id, completed_at').in('loan_id', loanIds),
      service.from('borrower_communications').select('loan_id, created_at').in('loan_id', loanIds).gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
      service.from('loan_timeline_events').select('loan_id, occurred_at').in('loan_id', loanIds).order('occurred_at', { ascending: false }),
    ]);

    const riskByLoan = new Map<string, { overall: number; lock: number }>();
    for (const r of (riskRes.data ?? []) as { loan_id: string; overall_risk_score: number; lock_expiry_risk: number }[]) {
      riskByLoan.set(r.loan_id, { overall: r.overall_risk_score ?? 0, lock: r.lock_expiry_risk ?? 0 });
    }

    const conditionsByLoan = new Map<string, { pending: number; total: number }>();
    for (const c of (conditionsRes.data ?? []) as { loan_id: string; status: string }[]) {
      const entry = conditionsByLoan.get(c.loan_id) ?? { pending: 0, total: 0 };
      entry.total++;
      if (c.status === 'pending' || c.status === 'received') entry.pending++;
      conditionsByLoan.set(c.loan_id, entry);
    }

    const milestonesByLoan = new Map<string, { completed: number; total: number }>();
    for (const m of (milestonesRes.data ?? []) as { loan_id: string; completed_at: string | null }[]) {
      const entry = milestonesByLoan.get(m.loan_id) ?? { completed: 0, total: 0 };
      entry.total++;
      if (m.completed_at) entry.completed++;
      milestonesByLoan.set(m.loan_id, entry);
    }

    const commsByLoan = new Map<string, number>();
    for (const c of (commsRes.data ?? []) as { loan_id: string }[]) {
      commsByLoan.set(c.loan_id, (commsByLoan.get(c.loan_id) ?? 0) + 1);
    }

    const lastTimelineByLoan = new Map<string, number>();
    // Use floor-based integer days (not live ms) so the value is stable within the same calendar day.
    const todayMidnightMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
    for (const t of (timelineRes.data ?? []) as { loan_id: string; occurred_at: string }[]) {
      if (!lastTimelineByLoan.has(t.loan_id)) {
        const eventMidnightMs = new Date(new Date(t.occurred_at).toISOString().slice(0, 10)).getTime();
        const daysAgo = Math.floor((todayMidnightMs - eventMidnightMs) / (1000 * 60 * 60 * 24));
        lastTimelineByLoan.set(t.loan_id, daysAgo);
      }
    }

    // Build context per loan
    const contexts: LoanContext[] = loans.map((loan: Record<string, unknown>) => {
      const risk = riskByLoan.get(loan.id as string) ?? { overall: 50, lock: 50 };
      const conds = conditionsByLoan.get(loan.id as string) ?? { pending: 0, total: 0 };
      const miles = milestonesByLoan.get(loan.id as string) ?? { completed: 0, total: 0 };
      const lockInfo = computeLockExpirySub(loan.lock_expiration_date as string | null);
      const borrower = loan.borrowers as { first_name?: string; last_name?: string } | null;

      return {
        loan_id: loan.id as string,
        loan_number: loan.loan_number as string,
        status: loan.status as string,
        loan_amount: loan.loan_amount as number | null,
        dti: loan.dti as number | null,
        ltv: loan.ltv as number | null,
        credit_score: loan.credit_score as number | null,
        lock_expiration_date: loan.lock_expiration_date as string | null,
        loan_officer_id: loan.loan_officer_id as string | null,
        sla_risk_score: risk.overall,
        lock_expiry_risk: lockInfo.score,
        days_to_lock_expiry: lockInfo.daysLeft,
        conditions_pending: conds.pending,
        conditions_total: conds.total,
        milestones_completed: miles.completed,
        milestones_total: miles.total,
        recent_comms_count: commsByLoan.get(loan.id as string) ?? 0,
        last_timeline_event_days_ago: lastTimelineByLoan.get(loan.id as string) ?? null,
        borrower_name: borrower ? `${borrower.first_name ?? ''} ${borrower.last_name ?? ''}`.trim() || null : null,
      };
    });

    // AI enrichment
    let aiResults: AiResult[] = [];
    let modelUsed = '';

    const { data: openaiSetting } = await service
      .from('integration_settings')
      .select('api_key, is_active')
      .eq('provider_name', 'openai')
      .maybeSingle();

    const apiKey = openaiSetting?.api_key || Deno.env.get('OPENAI_API_KEY');
    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || 'gpt-4o-mini';
    const temperature = typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0;
    modelUsed = model;

    // Load user personalization (M3) — skip for cron runs (uid is null)
    const personalizationPrompt = uid
      ? await getUserPersonalizationPrompt(supabaseUrl!, serviceKey!, agent.id, uid)
      : '';
    // Append structured output schema to system prompt (L5)
    const effectiveSystemPrompt = [
      agent.system_prompt,
      personalizationPrompt || null,
      PIPELINE_OUTPUT_SCHEMA,
    ].filter(Boolean).join('\n\n');

    const t0 = Date.now();

    if (apiKey) {
      try {
        const batchPayload = contexts.map((c) => ({
          loan_id: c.loan_id,
          loan_number: c.loan_number,
          status: c.status,
          loan_amount: c.loan_amount,
          dti: c.dti,
          ltv: c.ltv,
          credit_score: c.credit_score,
          sla_risk_score: c.sla_risk_score,
          lock_expiry_risk: c.lock_expiry_risk,
          days_to_lock_expiry: c.days_to_lock_expiry,
          conditions_pending: c.conditions_pending,
          conditions_total: c.conditions_total,
          milestones_completed: c.milestones_completed,
          milestones_total: c.milestones_total,
          recent_comms_count: c.recent_comms_count,
          last_timeline_event_days_ago: c.last_timeline_event_days_ago,
        }));

        // Use shared chatCompletion with response_format enforced (L5)
        const aiData = await chatCompletion(
          apiKey,
          [
            { role: 'system', content: effectiveSystemPrompt },
            { role: 'user', content: JSON.stringify(batchPayload) },
          ],
          { model, temperature, max_tokens: 4096, response_format: { type: 'json_object' } },
        );

        const raw = (aiData.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content ?? '';
        // Parse the "results" wrapper required by json_object mode (L5)
        try {
          const parsed = JSON.parse(raw) as { results?: AiResult[] };
          const results = Array.isArray(parsed.results) ? parsed.results : parseAiArray<AiResult>(raw) ?? [];
          aiResults = results;
        } catch {
          const fallback = parseAiArray<AiResult>(raw);
          if (fallback) aiResults = fallback;
        }
      } catch (aiErr) {
        const errMsg = (aiErr as Error).message ?? 'Unknown AI error';
        console.error('OpenAI error (non-fatal):', errMsg);
        await logAgentRun({
          supabaseUrl: supabaseUrl!, serviceRoleKey: serviceKey!,
          agentId: agent.id, userId: uid,
          input: `pipeline-prioritization batch=${contexts.length}`,
          output: null, status: 'failed',
          errorMessage: errMsg.slice(0, 2000),
          latencyMs: Date.now() - t0, modelUsed: model,
        });
      }
    }

    const latencyMs = Date.now() - t0;

    // Build AI lookup
    const aiByLoan = new Map<string, AiResult>();
    for (const r of aiResults) {
      if (r.loan_id) aiByLoan.set(r.loan_id, r);
    }

    // Compute final scores and upsert
    const upsertRows = contexts.map((ctx) => {
      const ai = aiByLoan.get(ctx.loan_id);
      const existing = existingByLoan.get(ctx.loan_id);
      const aiInputSnapshot = buildAiInputSnapshot(ctx);
      const previousSnapshot =
        (existing?.metadata as { ai_input_snapshot?: unknown } | null)?.ai_input_snapshot ?? null;
      const canReusePreviousAi =
        existing != null &&
        snapshotsEqual(previousSnapshot, aiInputSnapshot) &&
        existing.engagement_sub != null &&
        existing.close_probability_sub != null;

      const engagementScore = canReusePreviousAi
        ? clamp(Number(existing?.engagement_sub))
        : clamp(ai?.engagement_score ?? 50);
      const closeProbability = canReusePreviousAi
        ? clamp(Number(existing?.close_probability_sub))
        : clamp(ai?.close_probability ?? 50);
      const slaRisk = clamp(ctx.sla_risk_score);
      const lockExpiry = clamp(ctx.lock_expiry_risk);

      const urgency = clamp(
        0.30 * slaRisk +
        0.30 * lockExpiry +
        0.20 * (100 - engagementScore) +
        0.20 * (100 - closeProbability),
      );

      return {
        loan_id: ctx.loan_id,
        loan_officer_id: ctx.loan_officer_id,
        urgency_score: urgency,
        sla_risk_sub: slaRisk,
        lock_expiry_sub: lockExpiry,
        engagement_sub: engagementScore,
        close_probability_sub: closeProbability,
        urgency_reason: canReusePreviousAi
          ? existing?.urgency_reason ?? (urgency >= 70 ? 'High risk — review immediately' : urgency >= 40 ? 'Moderate risk — monitor closely' : 'On track')
          : ai?.urgency_reason ?? (urgency >= 70 ? 'High risk — review immediately' : urgency >= 40 ? 'Moderate risk — monitor closely' : 'On track'),
        ai_engagement_note: canReusePreviousAi ? existing?.ai_engagement_note ?? null : ai?.engagement_note ?? null,
        ai_close_note: canReusePreviousAi ? existing?.ai_close_note ?? null : ai?.close_note ?? null,
        model_used: modelUsed,
        metadata: {
          borrower_name: ctx.borrower_name,
          ai_input_snapshot: aiInputSnapshot,
        },
        scored_at: new Date().toISOString(),
      };
    });

    const { error: upsertErr } = await service
      .from('pipeline_priority_scores')
      .upsert(upsertRows, { onConflict: 'loan_id' });

    if (upsertErr) {
      console.error('Upsert error:', upsertErr);
      return jsonResp({ error: 'Failed to save priority scores' }, 500);
    }

    // Log agent run
    try {
      await service.from('ai_agent_runs').insert({
        agent_id: agent.id,
        user_id: uid,
        input: `prioritize ${contexts.length} loans`,
        output: JSON.stringify({ scored: contexts.length, ai_enriched: aiResults.length }),
        status: 'completed',
        model_used: modelUsed,
        latency_ms: latencyMs,
        metadata: { mode: isCron ? 'cron' : 'manual', loan_count: contexts.length },
      });
    } catch {
      // best effort logging only; ranking must still succeed
    }

    return jsonResp({
      scored: contexts.length,
      ai_enriched: aiResults.length,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error(err);
    return jsonResp({ error: 'Internal server error' }, 500);
  }
});
