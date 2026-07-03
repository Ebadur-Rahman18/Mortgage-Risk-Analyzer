/**
 * rate-alert-intelligence-agent — Monitors rate movements vs active locks.
 * 1. Loads active rate_locks with joined loan + borrower data
 * 2. Loads latest active rate_sheet_products for current market rates
 * 3. Deterministic: compare locked_rate vs current sheet rate
 * 4. AI enrichment: generates narrative + float-down/at-risk analysis
 * 5. Upserts rate_alert_analyses, dispatches in-app notifications
 * 6. Logs in ai_agent_runs
 *
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResp, parseAiArray, logAgentRun, getUserPersonalizationPrompt, chatCompletion } from '../_shared/ai-utils.ts';

const AGENT_SLUG = 'rate-alert-intelligence-agent';
const FLOAT_DOWN_THRESHOLD_BPS = 12.5; // 0.125%

/**
 * Structured output schema appended to every system prompt (L5).
 * Enforces JSON object mode (required by OpenAI response_format) with a "results" wrapper.
 */
const RATE_ALERT_OUTPUT_SCHEMA = `
You MUST respond with a valid JSON object in exactly this format — no other text:
{
  "results": [
    {
      "loan_id": "<uuid>",
      "narrative": "<2-3 sentence explanation of the rate situation and its impact on the borrower>",
      "recommendation": "<1-2 sentence actionable recommendation for the loan officer>"
    }
  ]
}
Include one object per flagged loan in the same order as the input. Do not add extra fields.`;

interface LockContext {
  loan_id: string;
  rate_lock_id: string;
  loan_number: string;
  borrower_name: string | null;
  product_name: string;
  locked_rate: number;
  current_market_rate: number;
  rate_delta: number;
  days_remaining: number;
  lock_term_days: number;
  loan_officer_id: string | null;
  branch_id: string | null;
  loan_amount: number | null;
  alert_type: 'at_risk' | 'float_down' | 'no_action';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

interface AiResult {
  loan_id: string;
  narrative: string;
  recommendation: string;
}


function computeDaysRemaining(lockExpiration: string): number {
  const now = Date.now();
  const exp = new Date(lockExpiration).getTime();
  return Math.round((exp - now) / (1000 * 60 * 60 * 24));
}

function determineSeverity(alertType: string, daysRemaining: number, rateDeltaAbs: number): 'critical' | 'high' | 'medium' | 'low' | 'none' {
  if (alertType === 'no_action') return 'none';
  if (alertType === 'at_risk') {
    if (daysRemaining <= 3) return 'critical';
    if (daysRemaining <= 7) return 'high';
    if (daysRemaining <= 14) return 'medium';
    return 'low';
  }
  // float_down
  if (rateDeltaAbs >= 0.5) return 'high';
  if (rateDeltaAbs >= 0.25) return 'medium';
  return 'low';
}

async function dispatchInAppNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  message: string,
  link: string | null,
  dedupeKey: string,
  type: 'info' | 'warning' = 'warning',
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      link,
      dedupe_key: dedupeKey,
      is_read: false,
      metadata: {},
    });
  } catch (e) {
    console.error('Notification dispatch failed (non-fatal):', e);
  }
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

    const body = (await req.json().catch(() => ({}))) as { mode?: string };
    const isCron = body.mode === 'cron';

    let uid: string | null = null;

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
    }

    const service = createClient(supabaseUrl, serviceKey);

    const { data: agent } = await service
      .from('ai_agents')
      .select('id, system_prompt, is_enabled, provider_config')
      .eq('slug', AGENT_SLUG)
      .maybeSingle();

    if (!agent?.is_enabled) {
      return jsonResp({ error: 'Rate Alert Intelligence Agent is disabled.' }, 400);
    }

    // 1. Load active rate locks with loan + borrower data
    const { data: activeLocks, error: locksErr } = await service
      .from('rate_locks')
      .select(`
        id, loan_id, locked_rate, lock_expiration, lock_term_days, product_name, status, branch_id,
        loans!inner(id, loan_number, loan_amount, loan_officer_id, branch_id, borrowers(first_name, last_name))
      `)
      .in('status', ['active', 'extended']);

    if (locksErr) {
      console.error('Rate locks query error:', locksErr);
      return jsonResp({ error: 'Failed to load rate locks' }, 500);
    }

    if (!activeLocks || activeLocks.length === 0) {
      return jsonResp({ message: 'No active rate locks found', scanned: 0, alerts: 0 });
    }

    // 2. Load latest active rate sheet and its products
    const { data: latestSheet } = await service
      .from('rate_sheets')
      .select('id')
      .eq('status', 'active')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestSheet) {
      return jsonResp({ error: 'No active rate sheet found. Upload or sync a rate sheet first.' }, 400);
    }

    const { data: sheetProducts } = await service
      .from('rate_sheet_products')
      .select('product_name, rate')
      .eq('rate_sheet_id', latestSheet.id);

    const rateByProduct = new Map<string, number>();
    for (const p of (sheetProducts ?? []) as { product_name: string; rate: number }[]) {
      const key = (p.product_name ?? '').toLowerCase().trim();
      if (key) rateByProduct.set(key, Number(p.rate));
    }

    // 3. Deterministic analysis per lock
    const contexts: LockContext[] = [];
    const scanTimestamp = new Date().toISOString();

    for (const lock of activeLocks as any[]) {
      const loan = lock.loans;
      if (!loan) continue;

      const productKey = (lock.product_name ?? '').toLowerCase().trim();
      const currentRate = rateByProduct.get(productKey);
      if (currentRate == null || lock.locked_rate == null) continue;

      const lockedRate = Number(lock.locked_rate);
      const delta = currentRate - lockedRate;
      const daysRemaining = computeDaysRemaining(lock.lock_expiration);
      const borrower = loan.borrowers as { first_name?: string; last_name?: string } | null;
      const borrowerName = borrower
        ? `${borrower.first_name ?? ''} ${borrower.last_name ?? ''}`.trim() || null
        : null;

      let alertType: 'at_risk' | 'float_down' | 'no_action' = 'no_action';

      if (delta > 0) {
        alertType = 'at_risk';
      } else if (Math.abs(delta) * 100 >= FLOAT_DOWN_THRESHOLD_BPS / 100) {
        alertType = 'float_down';
      }

      const severity = determineSeverity(alertType, daysRemaining, Math.abs(delta));

      contexts.push({
        loan_id: loan.id,
        rate_lock_id: lock.id,
        loan_number: loan.loan_number,
        borrower_name: borrowerName,
        product_name: lock.product_name ?? '',
        locked_rate: lockedRate,
        current_market_rate: currentRate,
        rate_delta: Math.round(delta * 10000) / 10000,
        days_remaining: daysRemaining,
        lock_term_days: lock.lock_term_days ?? 0,
        loan_officer_id: loan.loan_officer_id,
        branch_id: loan.branch_id ?? lock.branch_id,
        loan_amount: loan.loan_amount,
        alert_type: alertType,
        severity,
      });
    }

    if (contexts.length === 0) {
      return jsonResp({ message: 'No matching rate sheet products for active locks', scanned: 0, alerts: 0 });
    }

    // 4. AI enrichment for flagged loans
    const flagged = contexts.filter((c) => c.alert_type !== 'no_action');
    let aiResults: AiResult[] = [];
    let modelUsed = '';
    const t0 = Date.now();

    const { data: openaiSetting } = await service
      .from('integration_settings')
      .select('api_key, is_active')
      .eq('provider_name', 'openai')
      .maybeSingle();

    const apiKey = openaiSetting?.api_key || Deno.env.get('OPENAI_API_KEY');
    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || 'gpt-4o-mini';
    const temperature = typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0.3;
    modelUsed = model;

    // Load user personalization (M3) — uid may be null for cron runs
    const personalizationPrompt = uid
      ? await getUserPersonalizationPrompt(supabaseUrl!, serviceKey!, agent.id, uid)
      : '';
    // Append structured output schema to system prompt (L5)
    const effectiveSystemPrompt = [
      agent.system_prompt,
      personalizationPrompt || null,
      RATE_ALERT_OUTPUT_SCHEMA,
    ].filter(Boolean).join('\n\n');

    if (apiKey && flagged.length > 0) {
      try {
        const batchPayload = flagged.map((c) => ({
          loan_id: c.loan_id,
          loan_number: c.loan_number,
          borrower_name: c.borrower_name,
          product_name: c.product_name,
          locked_rate: c.locked_rate,
          current_market_rate: c.current_market_rate,
          rate_delta: c.rate_delta,
          days_remaining: c.days_remaining,
          lock_term_days: c.lock_term_days,
          loan_amount: c.loan_amount,
          alert_type: c.alert_type,
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
          supabaseUrl: Deno.env.get('SUPABASE_URL')!, serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          agentId: agent.id, userId: uid ?? null,
          input: `rate-alert batch=${flagged.length}`,
          output: null, status: 'failed',
          errorMessage: errMsg.slice(0, 2000),
          latencyMs: Date.now() - t0, modelUsed: model,
        });
      }
    }

    const latencyMs = Date.now() - t0;

    const aiByLoan = new Map<string, AiResult>();
    for (const r of aiResults) {
      if (r.loan_id) aiByLoan.set(r.loan_id, r);
    }

    // 5. Upsert results
    const upsertRows = contexts.map((ctx) => {
      const ai = aiByLoan.get(ctx.loan_id);

      let defaultNarrative = '';
      let defaultRecommendation = '';
      if (ctx.alert_type === 'at_risk') {
        defaultNarrative = `Market rates have risen ${Math.abs(ctx.rate_delta).toFixed(3)}% above the locked rate of ${ctx.locked_rate.toFixed(3)}%. The lock expires in ${ctx.days_remaining} days.`;
        defaultRecommendation = ctx.days_remaining <= 7
          ? 'Contact the borrower immediately to reassure them their rate is protected. Confirm closing timeline.'
          : 'Monitor the lock expiration. Consider contacting the borrower if rates continue rising.';
      } else if (ctx.alert_type === 'float_down') {
        defaultNarrative = `Market rates have dropped ${Math.abs(ctx.rate_delta).toFixed(3)}% below the locked rate of ${ctx.locked_rate.toFixed(3)}%. A float-down to ${ctx.current_market_rate.toFixed(3)}% may benefit the borrower.`;
        defaultRecommendation = 'Evaluate whether relocking at the lower rate is worth it given remaining lock days and potential extension fees.';
      }

      return {
        loan_id: ctx.loan_id,
        rate_lock_id: ctx.rate_lock_id,
        loan_officer_id: ctx.loan_officer_id,
        branch_id: ctx.branch_id,
        alert_type: ctx.alert_type,
        locked_rate: ctx.locked_rate,
        current_market_rate: ctx.current_market_rate,
        rate_delta: ctx.rate_delta,
        days_remaining: ctx.days_remaining,
        ai_narrative: ai?.narrative || defaultNarrative || null,
        ai_recommendation: ai?.recommendation || defaultRecommendation || null,
        severity: ctx.severity,
        metadata: {
          product_name: ctx.product_name,
          borrower_name: ctx.borrower_name,
          loan_number: ctx.loan_number,
          loan_amount: ctx.loan_amount,
          lock_term_days: ctx.lock_term_days,
          model_used: modelUsed,
        },
        scored_at: scanTimestamp,
      };
    });

    const { error: upsertErr } = await service
      .from('rate_alert_analyses')
      .upsert(upsertRows, { onConflict: 'loan_id,rate_lock_id' });

    if (upsertErr) {
      console.error('Upsert error:', upsertErr);
      return jsonResp({ error: 'Failed to save rate alert analyses' }, 500);
    }

    // 6. Dispatch notifications for flagged loans
    let notifCount = 0;
    for (const ctx of flagged) {
      if (!ctx.loan_officer_id) continue;
      const ai = aiByLoan.get(ctx.loan_id);
      const isAtRisk = ctx.alert_type === 'at_risk';

      const title = isAtRisk
        ? `Rate Lock At Risk — ${ctx.loan_number}`
        : `Float-Down Opportunity — ${ctx.loan_number}`;

      const message = ai?.narrative
        || (isAtRisk
          ? `Market rates rose ${Math.abs(ctx.rate_delta).toFixed(3)}% above locked rate. Lock expires in ${ctx.days_remaining} days.`
          : `Market rates dropped ${Math.abs(ctx.rate_delta).toFixed(3)}% below locked rate. Float-down opportunity available.`);

      const dedupeKey = `rate-alert-${ctx.loan_id}-${ctx.rate_lock_id}-${scanTimestamp.slice(0, 10)}`;

      await dispatchInAppNotification(
        service,
        ctx.loan_officer_id,
        title,
        message,
        `/loans/${ctx.loan_id}`,
        dedupeKey,
        isAtRisk ? 'warning' : 'info',
      );
      notifCount++;
    }

    // 7. Log agent run
    try {
      await service.from('ai_agent_runs').insert({
        agent_id: agent.id,
        user_id: uid,
        input: `scan ${contexts.length} active locks against rate sheet`,
        output: JSON.stringify({
          scanned: contexts.length,
          at_risk: contexts.filter((c) => c.alert_type === 'at_risk').length,
          float_down: contexts.filter((c) => c.alert_type === 'float_down').length,
          no_action: contexts.filter((c) => c.alert_type === 'no_action').length,
          notifications: notifCount,
        }),
        status: 'completed',
        model_used: modelUsed,
        latency_ms: latencyMs,
        metadata: { mode: isCron ? 'cron' : 'manual', lock_count: contexts.length },
      });
    } catch {
      // best effort logging
    }

    return jsonResp({
      scanned: contexts.length,
      at_risk: contexts.filter((c) => c.alert_type === 'at_risk').length,
      float_down: contexts.filter((c) => c.alert_type === 'float_down').length,
      no_action: contexts.filter((c) => c.alert_type === 'no_action').length,
      ai_enriched: aiResults.length,
      notifications: notifCount,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error(err);
    return jsonResp({ error: 'Internal server error' }, 500);
  }
});
