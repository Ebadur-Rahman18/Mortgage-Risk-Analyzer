/**
 * generate-borrower-update — Communication Center Agent: AI drafts from loan context.
 * Requires Authorization JWT. Validates loan_officer access and agent is_enabled.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ALLOWED_DOC_TYPES,
  DOCUMENT_GENERATION_AGENT_SLUG,
  buildUserMessageForDraft,
  parseOpenAiDraftJson,
} from '../_shared/borrower-comm-prompt.ts';
import { corsHeaders, getUserPersonalizationPrompt } from '../_shared/ai-utils.ts';

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      loan_id?: string;
      doc_type?: string;
      channel?: string;
      audience?: string;
      tone?: string;
      length_pref?: string;
      extra_instructions?: string;
    };

    const loan_id = body.loan_id;
    const doc_type = body.doc_type ?? 'status_update';
    if (!loan_id) {
      return new Response(JSON.stringify({ error: 'loan_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!ALLOWED_DOC_TYPES.has(doc_type)) {
      return new Response(JSON.stringify({ error: 'Invalid doc_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const channel = body.channel ?? 'email';
    const audience = body.audience ?? (doc_type === 'escalation_note' ? 'internal' : 'borrower');
    const tone = body.tone ?? null;
    const length_pref = body.length_pref ?? 'medium';
    const extra_instructions = body.extra_instructions?.trim() || null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('id, system_prompt, is_enabled, provider_config')
      .eq('slug', DOCUMENT_GENERATION_AGENT_SLUG)
      .maybeSingle();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Communication Center Agent not found. Create it in Admin → Agents.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!agent.is_enabled) {
      return new Response(
        JSON.stringify({ error: 'Communication Center Agent is disabled.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select(
        'id, loan_number, status, loan_amount, lock_expiration_date, loan_officer_id, borrower_id, property_address, property_city, property_state',
      )
      .eq('id', loan_id)
      .maybeSingle();

    if (loanError || !loan) {
      return new Response(JSON.stringify({ error: 'Loan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Align with borrower_communications RLS: loan officer on the file, or admin/moderator.
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const roles = new Set((roleRows ?? []).map((r: { role: string }) => r.role));
    const isPrivileged = roles.has('admin') || roles.has('moderator');
    if (!isPrivileged && loan.loan_officer_id !== user.id) {
      return new Response(
        JSON.stringify({
          error:
            'You can only generate drafts for loans where you are the assigned loan officer. Ask an admin if you need access.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const [borrowerRes, conditionsRes, riskRes, timelineRes] = await Promise.all([
      loan.borrower_id
        ? supabase
          .from('borrowers')
          .select('first_name, last_name, email, phone')
          .eq('id', loan.borrower_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('loan_conditions')
        .select('condition_type, status, description, created_at')
        .eq('loan_id', loan_id)
        .in('status', ['pending', 'received'])
        .limit(50),
      supabase
        .from('loan_risk_scores')
        .select('overall_risk_score, risk_level, risk_factors, lock_expiry_risk, stall_risk, condition_risk')
        .eq('loan_id', loan_id)
        .maybeSingle(),
      supabase
        .from('loan_timeline_events')
        .select('event_type, title, occurred_at')
        .eq('loan_id', loan_id)
        .order('occurred_at', { ascending: false })
        .limit(25),
    ]);

    const loanContext = {
      loan,
      borrower: borrowerRes.data ?? null,
      open_conditions: conditionsRes.data ?? [],
      risk_score: riskRes.data ?? null,
      recent_timeline: timelineRes.data ?? [],
      today: new Date().toISOString().split('T')[0],
    };

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

    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || 'gpt-4o-mini';
    const temperature =
      typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0.35;

    // Load user personalization (M3)
    const personalizationPrompt = await getUserPersonalizationPrompt(supabaseUrl, serviceRoleKey, agent.id, user.id);
    const effectiveSystemPrompt = personalizationPrompt
      ? `${agent.system_prompt}\n\n${personalizationPrompt}`
      : agent.system_prompt;

    const userMessage = buildUserMessageForDraft({
      doc_type,
      channel,
      audience,
      tone,
      length_pref,
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
          { role: 'system', content: effectiveSystemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OpenAI error:', errText);
      await supabase.from('ai_agent_runs').insert({
        agent_id: agent.id,
        user_id: user.id,
        input: `generate draft loan=${loan_id} doc_type=${doc_type}`,
        output: null,
        status: 'failed',
        error_message: errText.slice(0, 2000),
        model_used: model,
        latency_ms: Date.now() - t0,
      });
      return new Response(
        JSON.stringify({ error: 'AI generation failed', details: errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content ?? '';
    const parsed = parseOpenAiDraftJson(rawContent);

    const draft_content = parsed?.draft_content ?? '';
    const missing_data_notes = parsed?.missing_data_notes ?? [];
    const confidence = parsed?.confidence ?? 'medium';

    if (!draft_content) {
      await supabase.from('ai_agent_runs').insert({
        agent_id: agent.id,
        user_id: user.id,
        input: userMessage.slice(0, 8000),
        output: rawContent.slice(0, 8000),
        status: 'failed',
        error_message: 'Unparseable AI response',
        model_used: model,
        latency_ms: Date.now() - t0,
      });
      return new Response(
        JSON.stringify({
          error: 'Could not parse AI response as draft JSON',
          raw_preview: rawContent.slice(0, 500),
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const prompt_context = {
      doc_type,
      channel,
      audience,
      tone,
      length_pref,
      extra_instructions,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('borrower_communications')
      .insert({
        loan_id,
        created_by_user_id: user.id,
        agent_id: agent.id,
        doc_type,
        channel,
        audience,
        tone,
        length_pref,
        prompt_context,
        draft_content,
        missing_data_notes,
        confidence,
        draft_version: 1,
        status: 'draft',
        metadata: { raw_model_response_truncated: rawContent.slice(0, 2000) },
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error(insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save draft', details: insertError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('ai_agent_runs').insert({
      agent_id: agent.id,
      user_id: user.id,
      input: `generate draft loan=${loan_id} doc_type=${doc_type}`,
      output: JSON.stringify({ communication_id: inserted.id, confidence }),
      status: 'completed',
      model_used: model,
      latency_ms: Date.now() - t0,
      metadata: { communication_id: inserted.id },
    });

    return new Response(
      JSON.stringify({
        id: inserted.id,
        draft_content,
        missing_data_notes,
        confidence,
        status: 'draft',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
