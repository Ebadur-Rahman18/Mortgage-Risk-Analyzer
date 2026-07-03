/**
 * AI Chat Assistant Edge Function
 * Handles chat requests with OpenAI using stored API keys
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getOpenAIApiKey, chatCompletion } from '../_shared/ai-utils.ts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  /** When true, stream the response as SSE (text/event-stream). */
  stream?: boolean;
  /** Optional; defaults to ai-chat-assistant telemetry agent */
  agent_slug?: string;
  /** When true, skip inserting ai_agent_runs (caller logs with full context, e.g. useRunAgent). */
  skip_server_usage_log?: boolean;
}

const CHAT_TELEMETRY_SLUG = 'ai-chat-assistant';

async function logChatUsage(params: {
  service: ReturnType<typeof createClient>;
  jwt: string | null;
  agentId: string;
  messages: ChatMessage[];
  model: string;
  completion: Record<string, unknown>;
  startedAt: number;
}): Promise<void> {
  const { service, jwt, agentId, messages, model, completion, startedAt } = params;
  let userId: string | null = null;
  if (jwt) {
    const { data: { user } } = await service.auth.getUser(jwt);
    userId = user?.id ?? null;
  }

  const usage = completion.usage as
    | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    | undefined;
  const promptTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
  const completionTokens = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : 0;
  const totalTokens =
    typeof usage?.total_tokens === 'number'
      ? usage.total_tokens
      : promptTokens + completionTokens;

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const assistantOut =
    (completion.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content ?? '';
  const inputPreview = typeof lastUser?.content === 'string' ? lastUser.content.slice(0, 4000) : '';
  const outputPreview = typeof assistantOut === 'string' ? assistantOut.slice(0, 12000) : '';

  const latencyMs = Math.max(0, Math.round(Date.now() - startedAt));

  try {
    await service.from('ai_agent_runs').insert({
      agent_id: agentId,
      user_id: userId,
      input: inputPreview || null,
      output: outputPreview || null,
      status: 'completed',
      latency_ms: latencyMs,
      provider_used: 'openai',
      model_used: model,
      token_metrics: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
      metadata: {
        source: 'ai-chat-assistant',
        usage: usage ?? null,
      },
    });
  } catch (e) {
    console.error('ai_agent_runs insert (telemetry):', e);
  }
}


/**
 * Main handler
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get OpenAI API key
    console.log('Attempting to fetch OpenAI API key...');
    const apiKey = await getOpenAIApiKey();

    if (!apiKey) {
      console.error('No API key found in database or environment');
      return new Response(
        JSON.stringify({
          error: 'OpenAI API key not configured. Please configure it in Admin > Integrations or check edge function logs.',
          details: {
            hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
            hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
            hasEnvApiKey: !!Deno.env.get('OPENAI_API_KEY'),
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('API key retrieved successfully');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const service =
      supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey)
        : null;

    // Parse request body
    const {
      messages,
      model,
      temperature,
      max_tokens,
      stream,
      agent_slug: agentSlugFromBody,
      skip_server_usage_log: skipServerUsageLog,
    }: ChatRequest = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Messages array is required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.replace(/^Bearer\s+/i, '') ?? null;

    const startedAt = Date.now();
    const resolvedModel = model ?? 'gpt-4o-mini';

    // ── Streaming path (SSE) ─────────────────────────────────────────────────
    if (stream) {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolvedModel,
          temperature: temperature ?? 0.7,
          max_tokens: max_tokens ?? 4096,
          messages,
          stream: true,
        }),
      });

      if (!openaiRes.ok || !openaiRes.body) {
        const errText = await openaiRes.text().catch(() => 'Unknown OpenAI error');
        return new Response(JSON.stringify({ error: errText }), {
          status: openaiRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Collect full text while relaying chunks; fire-and-forget telemetry at the end.
      let collectedText = '';
      let promptTokens = 0;
      let completionTokens = 0;

      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          // Relay the raw bytes to the client as-is
          controller.enqueue(chunk);

          // Parse SSE lines to collect content for telemetry
          const text = decoder.decode(chunk, { stream: true });
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string') collectedText += delta;
              // usage is sometimes included in the final chunk
              const usage = parsed?.usage;
              if (usage?.prompt_tokens) promptTokens = usage.prompt_tokens;
              if (usage?.completion_tokens) completionTokens = usage.completion_tokens;
            } catch { /* non-fatal parse errors */ }
          }
        },
        flush() {
          // Fire-and-forget telemetry after stream ends
          if (service && !skipServerUsageLog) {
            const slug = agentSlugFromBody || CHAT_TELEMETRY_SLUG;
            const totalTokens = promptTokens + completionTokens;
            const latencyMs = Math.max(0, Date.now() - startedAt);
            const lastUser = [...messages].reverse().find((m) => m.role === 'user');
            service
              .from('ai_agents')
              .select('id')
              .eq('slug', slug)
              .maybeSingle()
              .then(({ data: agentRow }) => {
                if (!agentRow?.id) return;
                const userId$ = jwt
                  ? service.auth.getUser(jwt).then(({ data }) => data.user?.id ?? null)
                  : Promise.resolve(null);
                userId$.then((userId) => {
                  service.from('ai_agent_runs').insert({
                    agent_id: agentRow.id as string,
                    user_id: userId,
                    input: lastUser?.content?.slice(0, 4000) ?? null,
                    output: collectedText.slice(0, 12000) || null,
                    status: 'completed',
                    latency_ms: latencyMs,
                    provider_used: 'openai',
                    model_used: resolvedModel,
                    token_metrics: promptTokens > 0
                      ? { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens }
                      : null,
                    metadata: { source: 'ai-chat-assistant', streamed: true },
                  }).catch((e: unknown) => console.error('stream telemetry insert:', e));
                });
              })
              .catch((e: unknown) => console.error('stream telemetry agent lookup:', e));
          }
        },
      });

      // Pipe OpenAI response body through the transform stream
      openaiRes.body.pipeTo(writable).catch(() => {});

      return new Response(readable, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // ── Non-streaming path (buffered JSON response) ──────────────────────────

    // Call OpenAI
    const completion = await chatCompletion(apiKey, messages, {
      model: resolvedModel,
      temperature: temperature ?? 0.7,
      max_tokens,
    });

    if (service && !skipServerUsageLog) {
      const slug = agentSlugFromBody || CHAT_TELEMETRY_SLUG;
      const { data: agentRow } = await service
        .from('ai_agents')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (agentRow?.id) {
        await logChatUsage({
          service,
          jwt,
          agentId: agentRow.id as string,
          messages,
          model: resolvedModel,
          completion: completion as Record<string, unknown>,
          startedAt,
        });
      } else {
        console.warn('Telemetry agent not found for slug:', slug);
      }
    }

    // Return the response
    return new Response(JSON.stringify(completion), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    
    return new Response(
      JSON.stringify({
        error: (error as Error).message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
