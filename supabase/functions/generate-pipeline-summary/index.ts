/**
 * AI narrative summary from manager dashboard snapshot (Portfolio Summary Agent).
 * JWT required. Body: { snapshot: { metrics, pipeline, bottlenecks } }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getUserPersonalizationPrompt } from '../_shared/ai-utils.ts';

const PORTFOLIO_SUMMARY_AGENT_SLUG = 'portfolio-summary-agent';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    const body = (await req.json().catch(() => ({}))) as {
      snapshot?: {
        metrics?: Record<string, unknown>;
        pipeline?: unknown[];
        bottlenecks?: unknown[];
      };
    };

    if (!body.snapshot || typeof body.snapshot !== 'object') {
      return new Response(JSON.stringify({ error: 'snapshot object is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('id, system_prompt, is_enabled, provider_config')
      .eq('slug', PORTFOLIO_SUMMARY_AGENT_SLUG)
      .maybeSingle();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({
          error: 'Portfolio Summary Agent not found. Seed migrations or create it in Admin → AI Agents.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!agent.is_enabled) {
      return new Response(JSON.stringify({ error: 'Portfolio Summary Agent is disabled.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: openaiSetting } = await supabase
      .from('integration_settings')
      .select('api_key, is_active')
      .eq('provider_name', 'openai')
      .maybeSingle();

    const apiKey = openaiSetting?.api_key || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || 'gpt-4o-mini';
    const temperature =
      typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0.4;

    // Load user personalization (M3)
    const personalizationPrompt = await getUserPersonalizationPrompt(supabaseUrl, serviceRoleKey, agent.id, user.id);
    const effectiveSystemPrompt = personalizationPrompt
      ? `${agent.system_prompt}\n\n${personalizationPrompt}`
      : agent.system_prompt;

    const userMessage = `Dashboard snapshot (JSON):\n${JSON.stringify(body.snapshot, null, 2)}`;

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
        max_tokens: 1200,
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
        input: userMessage.slice(0, 8000),
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
    const summary = (aiResult.choices?.[0]?.message?.content ?? '').trim();
    if (!summary) {
      return new Response(JSON.stringify({ error: 'Empty AI response' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('ai_agent_runs').insert({
      agent_id: agent.id,
      user_id: user.id,
      input: 'generate-pipeline-summary',
      output: summary.slice(0, 8000),
      status: 'completed',
      model_used: model,
      latency_ms: Date.now() - t0,
    });

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
