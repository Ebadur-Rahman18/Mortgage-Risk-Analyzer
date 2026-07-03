/**
 * auto-draft-milestone-comm — Triggered (fire-and-forget) when a milestone is
 * completed. Maps milestone_type → doc_type, generates a draft via the existing
 * generate-borrower-update function logic, then notifies the loan officer.
 *
 * Body: { loan_id, milestone_type, milestone_name }
 *
 * All shared helpers are inlined so the function is self-contained for Supabase
 * Cloud Dashboard deployment (the _shared/ folder isn't available there).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Inlined: borrower-comm-prompt helpers ───────────────────────────────────
const DOCUMENT_GENERATION_AGENT_SLUG = 'document-generation-agent';

function buildUserMessageForDraft(params: {
  doc_type: string;
  channel: string;
  audience: string;
  tone: string | null;
  length_pref: string | null;
  extra_instructions: string | null;
  loanContext: Record<string, unknown>;
}): string {
  const { doc_type, channel, audience, tone, length_pref, extra_instructions, loanContext } = params;
  return [
    'Generate one communication draft from the following structured context.',
    `doc_type: ${doc_type}`,
    `channel: ${channel}`,
    `audience: ${audience}`,
    `tone_preference: ${tone ?? 'professional'}`,
    `length_preference: ${length_pref ?? 'medium'} (short = SMS-style brief, medium = email, long = detailed note)`,
    extra_instructions ? `additional_instructions: ${extra_instructions}` : '',
    '',
    'loan_context (JSON):',
    JSON.stringify(loanContext, null, 2),
    '',
    'Respond with only the JSON object described in your system instructions.',
  ]
    .filter(Boolean)
    .join('\n');
}

interface DraftParseResult {
  draft_content: string;
  missing_data_notes: string[];
  confidence: string;
}

function parseOpenAiDraftJson(raw: string): DraftParseResult | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) text = fence[1].trim();

  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const draft_content = typeof parsed.draft_content === 'string' ? parsed.draft_content : '';
    const missing_data_notes = Array.isArray(parsed.missing_data_notes)
      ? (parsed.missing_data_notes as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    const confidence = typeof parsed.confidence === 'string' ? parsed.confidence : 'medium';
    if (!draft_content) return null;
    return { draft_content, missing_data_notes, confidence };
  } catch {
    return null;
  }
}

// ─── Inlined: resolveSendGrid (from _shared/notify-credentials.ts) ──────────
interface SendGridResolved {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  source: 'env' | 'database' | 'merged';
}

async function resolveSendGrid(
  supabase: SupabaseClient,
): Promise<{ ok: true; creds: SendGridResolved } | { ok: false; error: string }> {
  const envKey = Deno.env.get('SENDGRID_API_KEY')?.trim() || '';
  const envFrom = Deno.env.get('SENDGRID_FROM_EMAIL')?.trim() || '';
  const envName = Deno.env.get('SENDGRID_FROM_NAME')?.trim() || 'Control Tower';

  const { data: row } = await supabase
    .from('integration_settings')
    .select('api_key, is_active, config')
    .eq('provider_name', 'sendgrid')
    .maybeSingle();

  const cfg = (row?.config ?? {}) as Record<string, unknown>;
  const dbKey = typeof row?.api_key === 'string' ? row.api_key.trim() : '';
  const dbFrom = typeof cfg.from_email === 'string' ? cfg.from_email.trim() : '';
  const dbName = typeof cfg.from_name === 'string' ? cfg.from_name.trim() : 'Control Tower';

  const apiKey = envKey || (row?.is_active !== false ? dbKey : '');
  const fromEmail = envFrom || dbFrom;
  const fromName = envName || dbName;

  if (!apiKey) return { ok: false, error: 'SendGrid not configured' };
  if (!fromEmail) return { ok: false, error: 'SendGrid from_email missing' };

  let source: SendGridResolved['source'] = 'merged';
  if (envKey && !row?.api_key) source = 'env';
  else if (!envKey && dbKey) source = 'database';

  return { ok: true, creds: { apiKey, fromEmail, fromName, source } };
}

// ─── Inlined: dispatchNotification (from _shared/dispatch-notification.ts) ───
type NotifyChannel = 'in_app' | 'email';

interface DispatchNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string | null;
  metadata?: Record<string, unknown>;
  channels: NotifyChannel[];
  email_to?: string | null;
  dedupe_key?: string | null;
}

interface DispatchNotificationResult {
  in_app?: { ok: boolean; id?: string; skipped?: boolean; error?: string };
  email?: { ok: boolean; error?: string };
  delivery_status: Record<string, unknown>;
}

async function sendSendGridEmail(params: {
  apiKey: string; fromEmail: string; fromName: string; to: string; subject: string; bodyText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.fromEmail, name: params.fromName },
      subject: params.subject,
      content: [{ type: 'text/plain', value: params.bodyText }],
    }),
  });
  if (res.ok || res.status === 202) return { ok: true };
  const errText = await res.text();
  return { ok: false, error: `SendGrid ${res.status}: ${errText.slice(0, 200)}` };
}

async function dispatchNotification(
  supabase: SupabaseClient,
  input: DispatchNotificationInput,
): Promise<DispatchNotificationResult> {
  const type = input.type ?? 'info';
  const channels = input.channels.length ? input.channels : (['in_app'] as NotifyChannel[]);
  const metadata = input.metadata ?? {};
  const result: DispatchNotificationResult = { delivery_status: {} };

  if (channels.includes('in_app')) {
    const row = {
      user_id: input.user_id, title: input.title, message: input.message, type,
      link: input.link ?? null, metadata: metadata as Record<string, unknown>,
      dedupe_key: input.dedupe_key ?? null, is_read: false,
    };
    const { data: inserted, error } = await supabase.from('notifications').insert(row).select('id').maybeSingle();
    if (error) {
      const msg = error.message || String(error);
      const isDup = (error as { code?: string }).code === '23505' || msg.includes('duplicate');
      if (isDup && input.dedupe_key) {
        result.in_app = { ok: true, skipped: true };
        result.delivery_status.in_app = 'skipped_duplicate';
      } else {
        result.in_app = { ok: false, error: msg };
        result.delivery_status.in_app = 'error';
        result.delivery_status.in_app_error = msg;
      }
    } else {
      result.in_app = { ok: true, id: inserted?.id as string | undefined };
      result.delivery_status.in_app = 'sent';
    }
  }

  let emailTo = input.email_to?.trim() || '';
  if (channels.includes('email')) {
    if (!emailTo) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', input.user_id).maybeSingle();
      emailTo = (profile?.email as string | undefined)?.trim() || '';
    }
    const sg = await resolveSendGrid(supabase);
    if (!sg.ok) {
      result.email = { ok: false, error: sg.error };
      result.delivery_status.email = 'skipped';
    } else if (!emailTo) {
      result.email = { ok: false, error: 'No email for user' };
      result.delivery_status.email = 'skipped';
    } else {
      const body = `${input.message}\n\n${input.link ? `Open: ${input.link}` : ''}`.trim();
      const send = await sendSendGridEmail({
        apiKey: sg.creds.apiKey, fromEmail: sg.creds.fromEmail, fromName: sg.creds.fromName,
        to: emailTo, subject: input.title, bodyText: body,
      });
      if (send.ok) { result.email = { ok: true }; result.delivery_status.email = 'sent'; }
      else { result.email = { ok: false, error: send.error }; result.delivery_status.email = 'error'; }
    }
  }

  if (result.in_app?.id) {
    await supabase.from('notifications').update({ delivery_status: result.delivery_status as Record<string, unknown> }).eq('id', result.in_app.id);
  }
  return result;
}

// ─── Milestone → doc_type mapping ────────────────────────────────────────────
const MILESTONE_TO_DOC_TYPE: Record<string, string> = {
  application_received: 'status_update',
  pre_approval: 'status_update',
  processing: 'status_update',
  submitted_to_underwriting: 'status_update',
  conditional_approval: 'condition_request',
  final_approval: 'status_update',
  clear_to_close: 'closing_notification',
  closing_scheduled: 'closing_notification',
  funded: 'status_update',
  rate_locked: 'rate_lock_reminder',
  appraisal_ordered: 'status_update',
  appraisal_received: 'status_update',
  title_ordered: 'status_update',
  title_received: 'status_update',
};

// ─── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return jsonResp({ error: 'Missing Supabase configuration' }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as {
      loan_id?: string;
      milestone_type?: string;
      milestone_name?: string;
    };

    const { loan_id, milestone_type, milestone_name } = body;
    if (!loan_id || !milestone_type) {
      return jsonResp({ error: 'loan_id and milestone_type are required' }, 400);
    }

    const doc_type = MILESTONE_TO_DOC_TYPE[milestone_type] ?? 'status_update';
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id, system_prompt, is_enabled, provider_config')
      .eq('slug', DOCUMENT_GENERATION_AGENT_SLUG)
      .maybeSingle();

    if (!agent?.is_enabled) {
      return jsonResp({ skipped: true, reason: 'Agent disabled or not found' });
    }

    const { data: loan } = await supabase
      .from('loans')
      .select(
        'id, loan_number, status, loan_amount, lock_expiration_date, loan_officer_id, borrower_id, property_address, property_city, property_state',
      )
      .eq('id', loan_id)
      .maybeSingle();

    if (!loan) {
      return jsonResp({ error: 'Loan not found' }, 404);
    }

    const [borrowerRes, conditionsRes, riskRes, timelineRes] = await Promise.all([
      loan.borrower_id
        ? supabase.from('borrowers').select('first_name, last_name, email, phone').eq('id', loan.borrower_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('loan_conditions').select('condition_type, status, description, created_at').eq('loan_id', loan_id).in('status', ['pending', 'received']).limit(50),
      supabase.from('loan_risk_scores').select('overall_risk_score, risk_level, risk_factors, lock_expiry_risk, stall_risk, condition_risk').eq('loan_id', loan_id).maybeSingle(),
      supabase.from('loan_timeline_events').select('event_type, title, occurred_at').eq('loan_id', loan_id).order('occurred_at', { ascending: false }).limit(25),
    ]);

    const loanContext = {
      loan,
      borrower: borrowerRes.data ?? null,
      open_conditions: conditionsRes.data ?? [],
      risk_score: riskRes.data ?? null,
      recent_timeline: timelineRes.data ?? [],
      triggered_by_milestone: { milestone_type, milestone_name: milestone_name ?? milestone_type },
      today: new Date().toISOString().split('T')[0],
    };

    const channel = 'email';
    const audience = doc_type === 'escalation_note' ? 'internal' : 'borrower';
    const extra_instructions = `This draft is auto-generated because the milestone "${milestone_name ?? milestone_type}" was just completed. Tailor the message to reflect this milestone event.`;

    const { data: openaiSetting } = await supabase
      .from('integration_settings')
      .select('api_key, is_active')
      .eq('provider_name', 'openai')
      .maybeSingle();

    const apiKey = openaiSetting?.api_key || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return jsonResp({ skipped: true, reason: 'OpenAI key not configured' });
    }

    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || 'gpt-4o-mini';
    const temperature =
      typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0.35;

    const userMessage = buildUserMessageForDraft({
      doc_type,
      channel,
      audience,
      tone: 'professional',
      length_pref: 'medium',
      extra_instructions,
      loanContext,
    });

    const t0 = Date.now();
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: agent.system_prompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OpenAI error:', errText);
      return jsonResp({ error: 'AI generation failed' }, 500);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content ?? '';
    const parsed = parseOpenAiDraftJson(rawContent);

    if (!parsed?.draft_content) {
      console.error('Unparseable AI response for auto-draft');
      return jsonResp({ skipped: true, reason: 'Unparseable AI response' });
    }

    const created_by = (loan.loan_officer_id as string) || null;

    const { data: inserted, error: insertError } = await supabase
      .from('borrower_communications')
      .insert({
        loan_id,
        created_by_user_id: created_by,
        agent_id: agent.id,
        doc_type,
        channel,
        audience,
        tone: 'professional',
        length_pref: 'medium',
        prompt_context: { doc_type, channel, audience, auto_triggered: true, milestone_type },
        draft_content: parsed.draft_content,
        missing_data_notes: parsed.missing_data_notes,
        confidence: parsed.confidence,
        draft_version: 1,
        status: 'draft',
        metadata: {
          auto_generated: true,
          milestone_type,
          milestone_name: milestone_name ?? milestone_type,
          raw_model_response_truncated: rawContent.slice(0, 2000),
        },
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return jsonResp({ error: 'Failed to save auto-draft' }, 500);
    }

    await supabase.from('ai_agent_runs').insert({
      agent_id: agent.id,
      user_id: created_by,
      input: `auto-draft milestone=${milestone_type} loan=${loan_id}`,
      output: JSON.stringify({ communication_id: inserted.id }),
      status: 'completed',
      model_used: model,
      latency_ms: Date.now() - t0,
      metadata: { communication_id: inserted.id, auto_generated: true },
    });

    if (created_by) {
      try {
        await dispatchNotification(supabase, {
          user_id: created_by,
          title: 'New auto-drafted communication',
          message: `A ${doc_type.replace(/_/g, ' ')} draft was auto-generated for loan ${loan.loan_number ?? ''} after "${milestone_name ?? milestone_type}" milestone. Review and approve it before it's sent.`,
          type: 'info',
          link: `/document-generation`,
          metadata: {
            event_type: 'auto_draft_created',
            communication_id: inserted.id,
            loan_id,
            milestone_type,
          },
          channels: ['in_app'],
          dedupe_key: `auto_draft:${loan_id}:${milestone_type}`,
        });
      } catch (e) {
        console.error('Notification dispatch error:', e);
      }
    }

    return jsonResp({
      ok: true,
      communication_id: inserted.id,
      doc_type,
      milestone_type,
    });
  } catch (err) {
    console.error(err);
    return jsonResp({ error: 'Internal server error' }, 500);
  }
});
