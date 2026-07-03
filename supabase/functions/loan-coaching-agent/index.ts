/**
 * Loan Coaching Agent Edge Function
 *
 * Enriches OpenAI chat completions with real-time loan context so the AI
 * can provide specific, actionable coaching on the loan being viewed.
 *
 * Accepts:
 *   POST { messages, loan_context, mode?, model?, temperature?, max_tokens? }
 *
 *   mode = "chat"                 → normal conversation with loan context
 *   mode = "proactive_suggestion" → generates a brief coaching tip from loan state alone
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  jsonResp,
  getOpenAIApiKey,
  chatCompletion,
  logAgentRun,
  getUserPersonalizationPrompt,
  type ChatMessage,
} from '../_shared/ai-utils.ts';

interface LoanContext {
  loan: Record<string, unknown>;
  conditions?: Record<string, unknown>[];
  milestones?: Record<string, unknown>[];
  risk_score?: Record<string, unknown> | null;
  risk_alerts?: Record<string, unknown>[];
}

interface CoachingRequest {
  messages: ChatMessage[];
  loan_context: LoanContext;
  mode?: 'chat' | 'proactive_suggestion';
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

const AGENT_SLUG = 'loan-coaching-agent';

const FALLBACK_SYSTEM_PROMPT =
  'You are an expert Senior Underwriter Coach. Guide the loan officer with concise, actionable advice based on the loan context provided.';

async function getAgentConfig(): Promise<{ systemPrompt: string; agentId: string | null; providerConfig: Record<string, unknown> }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return { systemPrompt: FALLBACK_SYSTEM_PROMPT, agentId: null, providerConfig: {} };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('ai_agents')
      .select('id, system_prompt, provider_config')
      .eq('slug', AGENT_SLUG)
      .eq('is_enabled', true)
      .maybeSingle();

    if (error || !data) return { systemPrompt: FALLBACK_SYSTEM_PROMPT, agentId: null, providerConfig: {} };
    return {
      systemPrompt: data.system_prompt || FALLBACK_SYSTEM_PROMPT,
      agentId: data.id as string,
      providerConfig: (data.provider_config as Record<string, unknown>) ?? {},
    };
  } catch {
    return { systemPrompt: FALLBACK_SYSTEM_PROMPT, agentId: null, providerConfig: {} };
  }
}

function buildLoanContextBlock(ctx: LoanContext): string {
  const sections: string[] = ['=== CURRENT LOAN CONTEXT ==='];

  const l = ctx.loan;
  sections.push(
    `\nLoan: #${l.loan_number ?? 'N/A'}`,
    `Status: ${l.status ?? 'unknown'}`,
    `Loan Amount: ${l.loan_amount != null ? `$${Number(l.loan_amount).toLocaleString()}` : 'N/A'}`,
    `Appraised Value: ${l.appraised_value != null ? `$${Number(l.appraised_value).toLocaleString()}` : 'N/A'}`,
    `LTV: ${l.ltv != null ? `${l.ltv}%` : 'N/A'}`,
    `Credit Score: ${l.credit_score ?? 'N/A'}`,
    `DTI: ${l.dti != null ? `${l.dti}%` : 'N/A'}`,
    `Purpose: ${l.purpose ?? 'N/A'}`,
    `Occupancy: ${l.occupancy_type ?? 'N/A'}`,
    `Property: ${[l.property_address, l.property_city, l.property_state, l.property_postal_code].filter(Boolean).join(', ') || 'N/A'}`,
    `Lock Date: ${l.lock_date ?? 'N/A'}`,
    `Lock Expiration: ${l.lock_expiration_date ?? 'N/A'}`,
  );

  if (l.borrower_name) {
    sections.push(`Borrower: ${l.borrower_name}`);
  }

  if (ctx.conditions && ctx.conditions.length > 0) {
    sections.push('\n--- Outstanding Conditions ---');
    for (const c of ctx.conditions) {
      const due = c.due_date ? ` (due ${c.due_date})` : '';
      sections.push(
        `• [${(c.status as string)?.toUpperCase() ?? 'UNKNOWN'}] ${c.description}${due} — type: ${c.condition_type}, category: ${c.category ?? 'general'}`,
      );
    }
  } else {
    sections.push('\nConditions: None on file.');
  }

  if (ctx.milestones && ctx.milestones.length > 0) {
    sections.push('\n--- Milestones ---');
    for (const m of ctx.milestones) {
      const status = m.completed_at ? 'COMPLETED' : 'PENDING';
      const due = m.due_date ? ` (due ${m.due_date})` : '';
      sections.push(`• [${status}] ${m.name}${due}`);
    }
  }

  if (ctx.risk_score) {
    const rs = ctx.risk_score;
    sections.push(
      `\n--- Risk Assessment ---`,
      `Overall Score: ${rs.overall_risk_score}/100 (${rs.risk_level})`,
      `Stall Risk: ${rs.stall_risk ?? 'N/A'}`,
      `Lock Expiry Risk: ${rs.lock_expiry_risk ?? 'N/A'}`,
      `Condition Risk: ${rs.condition_risk ?? 'N/A'}`,
    );
  }

  if (ctx.risk_alerts && ctx.risk_alerts.length > 0) {
    sections.push('\n--- Active Risk Alerts ---');
    for (const a of ctx.risk_alerts) {
      sections.push(`• [${a.severity}] ${a.alert_type}: ${a.message}`);
    }
  }

  sections.push('\n=== END LOAN CONTEXT ===');
  return sections.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
      return jsonResp({ error: 'OpenAI API key not configured. Set it in Admin → Integrations.' }, 401);
    }

    const body: CoachingRequest = await req.json();
    const {
      messages = [],
      loan_context,
      mode = 'chat',
      model: bodyModel,
      temperature: bodyTemp,
      max_tokens,
    } = body;

    if (!loan_context?.loan) {
      return jsonResp({ error: 'loan_context with loan data is required' }, 400);
    }

    const { systemPrompt, agentId, providerConfig } = await getAgentConfig();

    const model = bodyModel ?? (providerConfig.model as string) ?? 'gpt-4o-mini';
    const temperature = bodyTemp ??
      (typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0.6);

    // Load user personalization (M3)
    let personalizationPrompt = '';
    if (agentId && supabaseUrl && serviceRoleKey) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const jwt = authHeader.replace(/^Bearer\s+/i, '');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (jwt && anonKey) {
        try {
          const authClient = createClient(supabaseUrl, anonKey);
          const { data: { user } } = await authClient.auth.getUser(jwt);
          if (user?.id) {
            personalizationPrompt = await getUserPersonalizationPrompt(supabaseUrl, serviceRoleKey, agentId, user.id);
          }
        } catch { /* non-fatal */ }
      }
    }

    const contextBlock = buildLoanContextBlock(loan_context);
    const enrichedSystemPrompt = `${systemPrompt}${personalizationPrompt ? '\n\n' + personalizationPrompt : ''}\n\n${contextBlock}`;

    let finalMessages: ChatMessage[];

    if (mode === 'proactive_suggestion') {
      finalMessages = [
        { role: 'system', content: enrichedSystemPrompt },
        {
          role: 'user',
          content:
            'Based on the current loan context, provide a brief coaching summary (3-5 bullet points). Highlight the most critical items that need attention right now — missing docs, risk flags, approaching deadlines, or next steps to advance this loan. Be specific and actionable.',
        },
      ];
    } else {
      const hasSystem = messages.some((m) => m.role === 'system');
      finalMessages = hasSystem
        ? messages.map((m) =>
            m.role === 'system' ? { ...m, content: enrichedSystemPrompt } : m,
          )
        : [{ role: 'system', content: enrichedSystemPrompt }, ...messages];
    }

    const t0 = Date.now();
    let completion: Record<string, unknown>;
    try {
      completion = await chatCompletion(apiKey, finalMessages, { model, temperature, max_tokens });
    } catch (aiErr) {
      const latencyMs = Date.now() - t0;
      if (agentId && supabaseUrl && serviceRoleKey) {
        await logAgentRun({
          supabaseUrl,
          serviceRoleKey,
          agentId,
          userId: null,
          input: finalMessages[finalMessages.length - 1]?.content?.slice(0, 4000) ?? null,
          output: null,
          status: 'failed',
          errorMessage: (aiErr as Error).message,
          latencyMs,
          modelUsed: model,
        });
      }
      throw aiErr;
    }

    const latencyMs = Date.now() - t0;
    const usage = completion.usage as Record<string, unknown> | undefined;
    const outputText =
      (completion.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content ?? '';

    if (agentId && supabaseUrl && serviceRoleKey) {
      const lastUserMsg = [...finalMessages].reverse().find((m) => m.role === 'user');
      await logAgentRun({
        supabaseUrl,
        serviceRoleKey,
        agentId,
        userId: null,
        input: lastUserMsg?.content?.slice(0, 4000) ?? null,
        output: outputText.slice(0, 8000),
        status: 'completed',
        latencyMs,
        modelUsed: model,
        tokenMetrics: usage ?? null,
        metadata: { mode },
      });
    }

    return new Response(JSON.stringify(completion), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Loan Coaching Agent error:', error);
    return jsonResp({ error: (error as Error).message || 'Internal server error' }, 500);
  }
});
