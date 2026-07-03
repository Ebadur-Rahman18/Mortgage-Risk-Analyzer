/**
 * generate-daily-actions edge function
 *
 * Uses the "Action Items Agent" system prompt to generate prioritised
 * action items for a specific user based on their loans' conditions,
 * milestones, risk scores, and timeline events.
 *
 * Can be called on-demand (user clicks "Refresh") or via a scheduled trigger.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, logAgentRun, getUserPersonalizationPrompt } from '../_shared/ai-utils.ts';

interface GeneratedItem {
  title: string;
  description?: string;
  priority: string;
  suggested_due_date?: string;
  loan_id?: string;
  task_type?: string;
}

const VALID_TASK_TYPES = new Set([
  'rate_lock_expired',
  'rate_lock_expiring_soon',
  'stalled_pipeline',
  'pending_condition',
  'high_dti',
  'low_credit_score',
  'high_ltv',
  'upcoming_milestone',
  'general_follow_up',
]);

/**
 * Build a stable dedupe key.
 *
 * When the AI provides a task_type we use (task_type, loan_id) — this is
 * immune to the model rephrasing a title between runs.
 *
 * For legacy rows that pre-date task_type we fall back to a normalised title
 * (digits stripped so "expired 12 days ago" == "expired 17 days ago").
 */
function buildDedupeKey(
  taskType: string | null | undefined,
  title: string | null | undefined,
  loanId: string | null | undefined,
): string {
  if (taskType) {
    return `type:${taskType.toLowerCase().trim()}|${loanId ?? ''}`;
  }
  // Legacy fallback — title-based
  const normalizedTitle = (title ?? '')
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `title:${normalizedTitle}|${loanId ?? ''}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate JWT — extract user_id from verified session, never trust request body
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const user_id = userData.user.id;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch the Action Items Agent config
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('id, system_prompt, is_enabled, provider_config')
      .eq('slug', 'action-items-agent')
      .maybeSingle();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Action Items Agent not found. Create it in Admin → Agents.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!agent.is_enabled) {
      return new Response(
        JSON.stringify({ error: 'Action Items Agent is disabled.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Gather context: user's loans + conditions + risk scores
    const { data: loans } = await supabase
      .from('loans')
      .select('id, loan_number, status, lock_expiration_date, loan_amount, borrower_id')
      .eq('loan_officer_id', user_id)
      .in('status', ['application', 'processing', 'submitted_to_uw', 'conditional_approval', 'clear_to_close', 'docs_out']);

    if (!loans || loans.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active loans for this user. No action items generated.', items_created: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const loanIds = loans.map((l) => l.id);

    const [conditionsRes, riskRes, timelineRes] = await Promise.all([
      supabase
        .from('loan_conditions')
        .select('loan_id, condition_type, status, description, created_at')
        .in('loan_id', loanIds)
        .in('status', ['pending', 'received']),
      supabase
        .from('loan_risk_scores')
        .select('loan_id, overall_risk_score, risk_level, risk_factors, lock_expiry_risk, stall_risk, condition_risk')
        .in('loan_id', loanIds),
      supabase
        .from('loan_timeline_events')
        .select('loan_id, event_type, title, occurred_at')
        .in('loan_id', loanIds)
        .order('occurred_at', { ascending: false })
        .limit(50),
    ]);

    // 3. Build AI prompt context
    const contextStr = JSON.stringify({
      loans,
      open_conditions: conditionsRes.data ?? [],
      risk_scores: riskRes.data ?? [],
      recent_timeline: timelineRes.data ?? [],
      today: new Date().toISOString().split('T')[0],
    });

    // 4. Get OpenAI API key
    const { data: openaiSetting } = await supabase
      .from('integration_settings')
      .select('api_key, is_active')
      .eq('provider_name', 'openai')
      .maybeSingle();

    const apiKey = openaiSetting?.api_key || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5. Call OpenAI
    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || 'gpt-4o-mini';
    const temperature = typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0.3;

    // Load user personalization (M3)
    const personalizationPrompt = await getUserPersonalizationPrompt(supabaseUrl, serviceRoleKey, agent.id, user_id);
    const effectiveSystemPrompt = personalizationPrompt
      ? `${agent.system_prompt}\n\n${personalizationPrompt}`
      : agent.system_prompt;

    const t0 = Date.now();
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: effectiveSystemPrompt },
          { role: 'user', content: `Here is the current loan data for this user:\n${contextStr}\n\nGenerate action items as a JSON array.` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OpenAI error:', errText);
      await logAgentRun({
        supabaseUrl,
        serviceRoleKey,
        agentId: agent.id,
        userId: user_id,
        input: `Generate action items for user ${user_id} — ${loans.length} loans`,
        output: null,
        status: 'failed',
        errorMessage: errText.slice(0, 2000),
        latencyMs: Date.now() - t0,
        modelUsed: model,
      });
      return new Response(
        JSON.stringify({ error: 'AI generation failed', details: errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiResult = await aiResponse.json();
    const latencyMs = Date.now() - t0;
    const rawContent = aiResult.choices?.[0]?.message?.content ?? '[]';

    // 6. Parse AI output (extract JSON array from response)
    let items: GeneratedItem[] = [];
    try {
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('Failed to parse AI output:', rawContent);
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ message: 'AI did not generate any action items.', items_created: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 7. Deduplicate: fetch existing agent-generated action items for this user.
    //    We include completed items so that tasks the user has already resolved
    //    are not re-created on the next Generate run.
    //    Cancelled items are the only ones excluded — they are treated as
    //    "dismissed" and can be regenerated if the underlying issue persists.
    const { data: existingRows } = await supabase
      .from('action_items')
      .select('id, title, task_type, loan_id, status')
      .eq('assigned_to_user_id', user_id)
      .eq('source', 'agent')
      .in('status', ['not_started', 'in_progress', 'blocked', 'on_hold', 'completed']);

    // Build a map keyed by (task_type|loan_id) or (normalised-title|loan_id) for
    // legacy rows without a task_type.  The map stores id + status so we can
    // distinguish completed items (skip entirely) from active ones (update).
    // Any extra rows sharing the same key are cancelled as a clean-up step.
    const existingByKey = new Map<string, { id: string; status: string }>();
    const duplicateIds: string[] = [];
    for (const r of existingRows ?? []) {
      const key = buildDedupeKey(r.task_type ?? null, r.title ?? null, r.loan_id ?? null);
      if (!existingByKey.has(key)) {
        existingByKey.set(key, { id: r.id, status: r.status });
      } else {
        duplicateIds.push(r.id);
      }
    }

    if (duplicateIds.length > 0) {
      await supabase
        .from('action_items')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .in('id', duplicateIds);
    }

    const validLoanIds = new Set(loanIds);
    type Row = {
      title: string;
      description: string | null;
      task_type: string | null;
      created_by_user_id: string;
      assigned_to_user_id: string;
      assigned_by_user_id: null;
      watchers: string[];
      loan_id: string | null;
      agent_id: string;
      source: string;
      priority: string;
      due_date: string | null;
      status: string;
    };
    const toInsert: Row[] = [];
    const toUpdate: { id: string; description: string | null; due_date: string | null; priority: string; task_type: string | null }[] = [];

    // Deduplicate within a single generation run as well (AI may emit duplicates).
    const seenKeysInRun = new Set<string>();

    for (const item of items) {
      const title = item.title?.slice(0, 500) || 'Untitled action item';
      const loanId = item.loan_id && validLoanIds.has(item.loan_id) ? item.loan_id : null;
      const taskType = item.task_type && VALID_TASK_TYPES.has(item.task_type) ? item.task_type : null;
      const key = buildDedupeKey(taskType, title, loanId);

      // Skip intra-run duplicates.
      if (seenKeysInRun.has(key)) continue;
      seenKeysInRun.add(key);

      const existing = existingByKey.get(key);

      // If the user already completed this task, respect that — do not
      // re-create or re-open it on subsequent Generate runs.
      if (existing?.status === 'completed') continue;

      const row = {
        title,
        description: item.description?.slice(0, 2000) || null,
        task_type: taskType,
        created_by_user_id: user_id,
        assigned_to_user_id: user_id,
        assigned_by_user_id: null,
        watchers: [user_id],
        loan_id: loanId,
        agent_id: agent.id,
        source: 'agent',
        priority: ['high', 'normal', 'low'].includes(item.priority) ? item.priority : 'normal',
        due_date: item.suggested_due_date || null,
        status: 'not_started',
      };

      if (existing) {
        toUpdate.push({
          id: existing.id,
          description: row.description,
          due_date: row.due_date,
          priority: row.priority,
          task_type: row.task_type,
        });
      } else {
        toInsert.push(row);
      }
    }

    if (toUpdate.length > 0) {
      for (const u of toUpdate) {
        await supabase
          .from('action_items')
          .update({
            status: 'not_started',
            completed_at: null,
            description: u.description,
            due_date: u.due_date,
            priority: u.priority,
            task_type: u.task_type,
            updated_at: new Date().toISOString(),
          })
          .eq('id', u.id);
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('action_items').insert(toInsert);
      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save action items', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const itemsCreated = toInsert.length;
    const itemsReopened = toUpdate.length;
    const itemsDeduped = duplicateIds.length;

    // 8. Log the agent run
    await supabase.from('ai_agent_runs').insert({
      agent_id: agent.id,
      user_id,
      input: `Generated ${items.length} action items from ${loans.length} loans`,
      output: JSON.stringify(items).slice(0, 12000),
      status: 'completed',
      model_used: model,
      latency_ms: latencyMs,
      token_metrics: aiResult.usage ?? null,
      metadata: {
        items_created: itemsCreated,
        items_reopened: itemsReopened,
        items_skipped_duplicate: itemsReopened + itemsDeduped,
        loan_count: loans.length,
      },
    });

    const message =
      itemsReopened > 0
        ? `Generated ${items.length} items: ${itemsCreated} new, ${itemsReopened} existing updated (no duplicates).`
        : `Generated ${itemsCreated} action items`;

    return new Response(
      JSON.stringify({
        message,
        items_created: itemsCreated,
        items_reopened: itemsReopened,
      }),
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
