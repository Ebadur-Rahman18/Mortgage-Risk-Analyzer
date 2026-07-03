/**
 * Shared AI utilities for Supabase Edge Functions
 *
 * Provides: corsHeaders, jsonResp, getOpenAIApiKey, normalizeRole,
 *           parseAiJson, parseAiArray, logAgentRun, chatCompletion,
 *           getProviderApiKey, routedChatCompletion
 *
 * Usage:  import { corsHeaders, jsonResp, getOpenAIApiKey, ... } from '../_shared/ai-utils.ts';
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

// ── Response helpers ──────────────────────────────────────────────────────────

export function jsonResp(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function handleCors(): Response {
  return new Response('ok', { headers: corsHeaders });
}

// ── API key retrieval ─────────────────────────────────────────────────────────

/**
 * Retrieves the OpenAI API key:
 * 1. Checks integration_settings table (admin-configured)
 * 2. Falls back to OPENAI_API_KEY environment variable
 */
export async function getOpenAIApiKey(): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase
        .from('integration_settings')
        .select('api_key, is_active')
        .eq('provider_name', 'openai')
        .maybeSingle();

      if (!error && data?.is_active && data.api_key) {
        return data.api_key as string;
      }
    } catch (e) {
      console.error('ai-utils: failed to fetch OpenAI key from DB:', e);
    }
  }

  return Deno.env.get('OPENAI_API_KEY') ?? null;
}

// ── Role normalization ────────────────────────────────────────────────────────

/** Normalizes role strings to snake_case for consistent comparisons. */
export function normalizeRole(input: string | null | undefined): string {
  return (input ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

// ── JSON parsers ──────────────────────────────────────────────────────────────

/**
 * Extracts and parses the first JSON object from an LLM response string.
 * Handles markdown code fences (```json ... ```) and leading/trailing text.
 * Returns null on parse failure.
 */
export function parseAiJson<T = Record<string, unknown>>(raw: string): T | null {
  let text = raw.trim();

  // Strip code fences
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) text = fence[1].trim();

  // Find the first '{' and its matching '}'
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) return null;

  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Extracts and parses the first JSON array from an LLM response string.
 * Handles markdown code fences and leading/trailing text.
 * Returns null on parse failure.
 */
export function parseAiArray<T = unknown>(raw: string): T[] | null {
  let text = raw.trim();

  // Strip code fences
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) text = fence[1].trim();

  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) return null;

  try {
    return JSON.parse(text.slice(start, end + 1)) as T[];
  } catch {
    return null;
  }
}

// ── OpenAI chat completion ────────────────────────────────────────────────────

// ── Tool calling types (L3) ───────────────────────────────────────────────────

/** JSON-Schema-compatible parameter descriptor for a tool. */
export interface ToolParameterSchema {
  type: string;
  properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
  description?: string;
}

/** A single OpenAI-compatible tool definition (function calling). */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
}

/**
 * Extended ChatMessage that supports tool_calls (assistant) and tool results.
 * When role === 'tool', `tool_call_id` and `name` must be present.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Present when role === 'assistant' and the model requested tool invocations. */
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  /** Present when role === 'tool' — references which tool_call this result belongs to. */
  tool_call_id?: string;
  /** Present when role === 'tool' — the name of the function that was invoked. */
  name?: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  /** OpenAI function/tool definitions to enable tool calling. */
  tools?: ToolDefinition[];
  /** 'auto' lets the model decide, 'none' disables, or a specific tool name. */
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

/**
 * Calls the OpenAI chat completions endpoint and returns the full response object.
 * Throws on non-200 HTTP status.
 */
export async function chatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<Record<string, unknown>> {
  const {
    model = 'gpt-4o-mini',
    temperature = 0.7,
    max_tokens,
    response_format,
    tools,
    tool_choice,
  } = options;

  const body: Record<string, unknown> = { model, messages, temperature };
  if (max_tokens != null) body.max_tokens = max_tokens;
  if (response_format) body.response_format = response_format;
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = tool_choice ?? 'auto';
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message: string;
    try {
      message = (JSON.parse(errorText) as { error?: { message?: string } }).error?.message
        ?? `OpenAI API error: ${response.status}`;
    } catch {
      message = `OpenAI API error (${response.status}): ${errorText || 'Unknown error'}`;
    }
    throw new Error(message);
  }

  const text = await response.text();
  return JSON.parse(text) as Record<string, unknown>;
}

// ── Multi-provider routing dispatcher (L2) ────────────────────────────────────

/**
 * Supported LLM providers.
 * 'openai' is the default. Other providers can be enabled by storing
 * their API keys in integration_settings using their provider_name.
 */
export type LLMProvider = 'lovable' | 'openai' | 'anthropic' | 'google' | 'perplexity';

/**
 * Retrieves an API key for the given provider from integration_settings or env vars.
 * Falls back to env vars: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, PERPLEXITY_API_KEY.
 */
export async function getProviderApiKey(provider: LLMProvider): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data } = await supabase
        .from('integration_settings')
        .select('api_key, is_active')
        .eq('provider_name', provider)
        .maybeSingle();
      if (data?.is_active && data.api_key) {
        return data.api_key as string;
      }
    } catch { /* non-fatal */ }
  }

  const envMap: Record<LLMProvider, string> = {
    lovable: 'LOVABLE_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_AI_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
  };
  return Deno.env.get(envMap[provider]) ?? null;
}

/**
 * Normalizes an OpenAI-format response into a provider-neutral shape:
 * { output: string, usage: { prompt_tokens, completion_tokens, total_tokens }, raw: ... }
 */
export interface RoutedCompletionResult {
  output: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  provider: LLMProvider;
  model: string;
  raw: Record<string, unknown>;
}

/**
 * Calls the Anthropic Messages API and normalizes the response to OpenAI format.
 */
async function anthropicChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions & { provider_model?: string },
): Promise<RoutedCompletionResult> {
  const model = options.provider_model ?? options.model ?? 'claude-3-haiku-20240307';
  const max_tokens = options.max_tokens ?? 4096;
  const temperature = options.temperature ?? 0.7;

  // Split system message from conversation
  const systemMsg = messages.find((m) => m.role === 'system');
  const conversationMsgs = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    max_tokens,
    temperature,
    messages: conversationMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) body.system = systemMsg.content;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${err}`);
  }

  const raw = await response.json() as Record<string, unknown>;
  const contentBlocks = (raw.content as Array<{ type: string; text?: string }> | undefined) ?? [];
  const output = contentBlocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  const usage = raw.usage as { input_tokens?: number; output_tokens?: number } | undefined;

  return {
    output,
    usage: usage
      ? {
          prompt_tokens: usage.input_tokens ?? 0,
          completion_tokens: usage.output_tokens ?? 0,
          total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        }
      : null,
    provider: 'anthropic',
    model,
    raw,
  };
}

/**
 * Calls the Google Gemini API and normalizes the response to provider-neutral format.
 */
async function googleChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions & { provider_model?: string },
): Promise<RoutedCompletionResult> {
  const requestedModel = options.provider_model ?? options.model ?? 'gemini-2.0-flash';
  const temperature = options.temperature ?? 0.7;
  const maxOutputTokens = options.max_tokens ?? 4096;

  // Build Gemini contents array; system instruction goes separately
  const systemMsg = messages.find((m) => m.role === 'system');
  const conversationMsgs = messages.filter((m) => m.role !== 'system');

  const contents = conversationMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature, maxOutputTokens },
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const normalizeGoogleModel = (modelName: string): string =>
    modelName.replace(/^models\//, '').trim();

  const extractGoogleOutput = (raw: Record<string, unknown>) => {
    const candidates = (raw.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined) ?? [];
    const output = candidates[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const usageMeta = raw.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
    return { output, usageMeta };
  };

  const callGoogleModel = async (modelName: string) => {
    const normalizedModel = normalizeGoogleModel(modelName);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // keep null when body is non-JSON
    }
    return { normalizedModel, response, text, parsed };
  };

  const listGoogleGenerateModels = async (): Promise<string[]> => {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl, { method: 'GET' });
    if (!listRes.ok) return [];
    const raw = await listRes.json() as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const models = raw.models ?? [];
    return models
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => normalizeGoogleModel(m.name ?? ''))
      .filter((m) => m.length > 0);
  };

  const pickGoogleFallback = (availableModels: string[]): string | null => {
    if (availableModels.length === 0) return null;
    const preferredOrder = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ];
    const exact = preferredOrder.find((preferred) => availableModels.includes(preferred));
    return exact ?? availableModels[0] ?? null;
  };

  let callResult = await callGoogleModel(requestedModel);

  // If a specific model name is stale/not found, auto-discover a supported model and retry once.
  const googleErr = callResult.parsed?.error as { status?: string } | undefined;
  const shouldRetryModelResolution =
    !callResult.response.ok &&
    (callResult.response.status === 404 || googleErr?.status === 'NOT_FOUND');

  if (shouldRetryModelResolution) {
    try {
      const availableModels = await listGoogleGenerateModels();
      const fallbackModel = pickGoogleFallback(availableModels);
      if (fallbackModel && fallbackModel !== callResult.normalizedModel) {
        callResult = await callGoogleModel(fallbackModel);
      }
    } catch (fallbackErr) {
      console.warn('googleChatCompletion: model discovery failed (non-fatal):', fallbackErr);
    }
  }

  if (!callResult.response.ok) {
    throw new Error(`Google AI API error (${callResult.response.status}): ${callResult.text}`);
  }

  const raw = (callResult.parsed ?? {}) as Record<string, unknown>;
  const { output, usageMeta } = extractGoogleOutput(raw);

  return {
    output,
    usage: usageMeta
      ? {
          prompt_tokens: usageMeta.promptTokenCount ?? 0,
          completion_tokens: usageMeta.candidatesTokenCount ?? 0,
          total_tokens: (usageMeta.promptTokenCount ?? 0) + (usageMeta.candidatesTokenCount ?? 0),
        }
      : null,
    provider: 'google',
    model: callResult.normalizedModel,
    raw,
  };
}

/**
 * Calls the Perplexity chat completions API and normalizes the response to
 * provider-neutral format. Perplexity's schema is OpenAI-compatible.
 */
async function perplexityChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions & { provider_model?: string },
): Promise<RoutedCompletionResult> {
  const model = options.provider_model ?? options.model ?? 'llama-3.1-sonar-small-128k-online';
  const temperature = options.temperature ?? 0.7;
  const max_tokens = options.max_tokens;

  const body: Record<string, unknown> = { model, messages, temperature };
  if (typeof max_tokens === 'number') body.max_tokens = max_tokens;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${err}`);
  }

  const raw = await response.json() as Record<string, unknown>;
  const choices = (raw.choices as Array<{ message?: { content?: string } }> | undefined) ?? [];
  const output = choices[0]?.message?.content ?? '';
  const usage = raw.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  return {
    output,
    usage: usage
      ? {
          prompt_tokens: usage.prompt_tokens ?? 0,
          completion_tokens: usage.completion_tokens ?? 0,
          total_tokens: usage.total_tokens ?? ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)),
        }
      : null,
    provider: 'perplexity',
    model,
    raw,
  };
}

/**
 * Calls the Lovable AI Gateway (OpenAI-compatible). Uses LOVABLE_API_KEY which
 * is auto-provisioned in Supabase Edge env. Acts as a zero-config seed provider
 * so agents work out-of-the-box until an admin configures OpenAI/Anthropic/Google.
 */
async function lovableChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions & { provider_model?: string },
): Promise<RoutedCompletionResult> {
  const model = options.provider_model ?? options.model ?? 'google/gemini-3-flash-preview';
  const temperature = options.temperature ?? 0.7;
  const max_tokens = options.max_tokens;

  const body: Record<string, unknown> = { model, messages, temperature };
  if (typeof max_tokens === 'number') body.max_tokens = max_tokens;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) {
      throw new Error('Lovable AI rate limit reached. Please retry shortly or add credits in Settings → Workspace → Usage.');
    }
    if (response.status === 402) {
      throw new Error('Lovable AI credits exhausted. Add credits in Settings → Workspace → Usage, or configure your own OpenAI/Anthropic/Google key in Admin → Integrations.');
    }
    throw new Error(`Lovable AI Gateway error (${response.status}): ${err}`);
  }

  const raw = await response.json() as Record<string, unknown>;
  const choices = (raw.choices as Array<{ message?: { content?: string } }> | undefined) ?? [];
  const output = choices[0]?.message?.content ?? '';
  const usage = raw.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  return {
    output,
    usage: usage
      ? {
          prompt_tokens: usage.prompt_tokens ?? 0,
          completion_tokens: usage.completion_tokens ?? 0,
          total_tokens: usage.total_tokens ?? ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)),
        }
      : null,
    provider: 'lovable',
    model,
    raw,
  };
}

/**
 * Multi-provider chat completion dispatcher.
 *
 * Reads `provider_config.provider` (defaults to 'lovable'). If the configured
 * provider has no API key, automatically falls back to the Lovable AI Gateway
 * so agents stay usable until an admin connects their own LLM provider.
 */
export async function routedChatCompletion(
  messages: ChatMessage[],
  providerConfig: Record<string, unknown>,
): Promise<RoutedCompletionResult> {
  const requestedProvider = (providerConfig.provider as LLMProvider | undefined) ?? 'lovable';
  const model = (providerConfig.model as string | undefined) ?? undefined;
  const temperature = typeof providerConfig.temperature === 'number' ? providerConfig.temperature : undefined;
  const max_tokens = typeof providerConfig.max_tokens === 'number' ? providerConfig.max_tokens : undefined;
  const provider_model = (providerConfig.provider_model as string | undefined) ?? model;

  let provider = requestedProvider;
  let apiKey = await getProviderApiKey(provider);

  // Seed/fallback: if the configured provider has no key, route via Lovable AI Gateway.
  if (!apiKey && provider !== 'lovable') {
    const lovableKey = await getProviderApiKey('lovable');
    if (lovableKey) {
      console.log(`routedChatCompletion: no key for '${provider}', falling back to Lovable AI Gateway.`);
      provider = 'lovable';
      apiKey = lovableKey;
    }
  }

  if (!apiKey) {
    throw new Error(`API key for provider '${requestedProvider}' is not configured. Set it in Admin → Integrations, or enable Lovable AI.`);
  }

  if (provider === 'lovable') {
    // When falling back, use a sensible Lovable Gateway model regardless of the originally requested provider's model name.
    const lovableModel = provider === requestedProvider
      ? (provider_model ?? model)
      : 'google/gemini-3-flash-preview';
    return lovableChatCompletion(apiKey, messages, { model: lovableModel, temperature, max_tokens, provider_model: lovableModel });
  }

  if (provider === 'anthropic') {
    return anthropicChatCompletion(apiKey, messages, { model, temperature, max_tokens, provider_model });
  }

  if (provider === 'google') {
    return googleChatCompletion(apiKey, messages, { model, temperature, max_tokens, provider_model });
  }

  if (provider === 'perplexity') {
    return perplexityChatCompletion(apiKey, messages, { model, temperature, max_tokens, provider_model });
  }

  // Default: OpenAI
  const resolvedModel = model ?? 'gpt-4o-mini';
  const raw = await chatCompletion(apiKey, messages, { model: resolvedModel, temperature, max_tokens });
  const choices = (raw.choices as Array<{ message?: { content?: string } }> | undefined) ?? [];
  const output = choices[0]?.message?.content ?? '';
  const usage = raw.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  return {
    output,
    usage: usage
      ? {
          prompt_tokens: usage.prompt_tokens ?? 0,
          completion_tokens: usage.completion_tokens ?? 0,
          total_tokens: usage.total_tokens ?? 0,
        }
      : null,
    provider: 'openai',
    model: resolvedModel,
    raw,
  };
}

// ── User personalization ──────────────────────────────────────────────────────

/**
 * Loads any additional_prompt from user_agent_personalizations for the given
 * agent + user combination. Returns an empty string if the table doesn't exist
 * or if no personalization is configured.
 */
export async function getUserPersonalizationPrompt(
  supabaseUrl: string,
  serviceRoleKey: string,
  agentId: string,
  userId: string,
): Promise<string> {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from('user_agent_personalizations')
      .select('additional_prompt')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .maybeSingle();
    return (data?.additional_prompt as string | null) ?? '';
  } catch {
    return '';
  }
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

export interface LogAgentRunParams {
  supabaseUrl: string;
  serviceRoleKey: string;
  agentId: string;
  userId: string | null;
  input: string | null;
  output: string | null;
  status: 'completed' | 'failed';
  errorMessage?: string | null;
  latencyMs?: number | null;
  modelUsed?: string | null;
  providerUsed?: string | null;
  tokenMetrics?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Writes a row to ai_agent_runs. Non-fatal — logs errors but never throws.
 */
export async function logAgentRun(params: LogAgentRunParams): Promise<void> {
  const {
    supabaseUrl,
    serviceRoleKey,
    agentId,
    userId,
    input,
    output,
    status,
    errorMessage = null,
    latencyMs = null,
    modelUsed = null,
    providerUsed = 'openai',
    tokenMetrics = null,
    metadata = null,
  } = params;

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await supabase.from('ai_agent_runs').insert({
      agent_id: agentId,
      user_id: userId,
      input: input?.slice(0, 8000) ?? null,
      output: output?.slice(0, 12000) ?? null,
      status,
      error_message: errorMessage?.slice(0, 2000) ?? null,
      latency_ms: latencyMs,
      model_used: modelUsed,
      provider_used: providerUsed,
      token_metrics: tokenMetrics,
      metadata,
    });
  } catch (e) {
    console.error('ai-utils logAgentRun: failed to write ai_agent_runs:', e);
  }
}
