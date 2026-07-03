/**
 * run-ai-agent — Centralized agent execution endpoint.
 *
 * Resolves the agent config server-side (system_prompt, provider_config, personalization),
 * builds the messages array, calls the LLM (multi-provider), executes tool calls
 * (L3 — OpenAI function calling), logs to ai_agent_runs, and returns the response.
 *
 * This prevents client-side system prompt injection (H6) and provides a unified
 * execution entry point for the admin AI agents panel.
 *
 * POST { agent_slug, input, context?, conversation_history?, conversation_id? }
 * Authorization: Bearer <jwt>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  jsonResp,
  logAgentRun,
  routedChatCompletion,
  type ChatMessage,
} from '../_shared/ai-utils.ts';
import {
  executeBuiltInTool,
  resolveAgentToolsFromMetadata,
  type KnowledgeSearchScope,
} from '../_shared/tool-executor.ts';
import { isAgentAllowedForUserEdge, loadRoleProfileForEdge } from '../_shared/agent-access.ts';

interface RunAgentRequest {
  agent_slug?: string;
  agent_id?: string;
  input: string;
  context?: Record<string, unknown>;
  conversation_history?: ChatMessage[];
  /** Optional: existing conversation_id to continue a thread */
  conversation_id?: string;
}

type LlmProvider = 'lovable' | 'openai' | 'google' | 'anthropic' | 'perplexity';

function defaultModelForProvider(provider: LlmProvider): string {
  if (provider === 'lovable') return 'google/gemini-3-flash-preview';
  if (provider === 'google') return 'gemini-2.0-flash';
  if (provider === 'anthropic') return 'claude-3-5-haiku-latest';
  if (provider === 'perplexity') return 'llama-3.1-sonar-small-128k-online';
  return 'gpt-4o-mini';
}

function normalizeModelForProvider(model: string | null, provider: LlmProvider): string {
  const fallback = defaultModelForProvider(provider);
  if (!model) return fallback;

  const normalized = model.trim();
  if (!normalized) return fallback;

  if (provider === 'lovable') {
    if (/^gpt-|^o\d|^claude|^gemini-[^/]/i.test(normalized) && !normalized.includes('/')) {
      return fallback;
    }
    return normalized;
  }
  if (provider === 'google') {
    if (/^gpt-|^o\d|^claude/i.test(normalized)) return fallback;
    return normalized;
  }
  if (provider === 'anthropic') {
    if (/^gpt-|^gemini/i.test(normalized)) return fallback;
    return normalized;
  }
  if (provider === 'perplexity') {
    if (/^gpt-|^gemini|^claude/i.test(normalized)) return fallback;
    return normalized;
  }
  if (/^gemini|^claude/i.test(normalized)) return fallback;
  return normalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResp({ error: 'Missing Supabase configuration' }, 500);
  }

  // Validate JWT when available. If absent/invalid, continue in degraded mode:
  // run completion but skip user-scoped personalization/memory/thread persistence.
  const authHeader = req.headers.get('Authorization');
  let userId: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser();
      if (!userErr && userData.user) {
        userId = userData.user.id;
      } else {
        console.warn('run-ai-agent: invalid bearer token, continuing without user context');
      }
    } catch (authErr) {
      console.warn('run-ai-agent: auth validation failed, continuing without user context', authErr);
    }
  }
  const service = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = (await req.json().catch(() => ({}))) as RunAgentRequest;
    const { agent_slug, agent_id, input, context, conversation_history, conversation_id: existingConvId } = body;

    if ((!agent_slug && !agent_id) || !input?.trim()) {
      return jsonResp({ error: 'agent_slug or agent_id and input are required' }, 400);
    }

    // 1. Load agent config server-side (never trust client-supplied system prompt)
    const agentQuery = service
      .from('ai_agents')
      .select('id, name, slug, system_prompt, is_enabled, provider_config, metadata, memory_enabled, required_role');

    const { data: agent, error: agentErr } = agent_id
      ? await agentQuery.eq('id', agent_id).maybeSingle()
      : await agentQuery.eq('slug', agent_slug).maybeSingle();

    if (agentErr || !agent) {
      const lookupValue = agent_id ?? agent_slug;
      return jsonResp({ error: `Agent '${lookupValue}' not found` }, 404);
    }
    if (!agent.is_enabled) {
      return jsonResp({ error: `Agent '${agent_slug}' is disabled` }, 400);
    }

    if (userId) {
      const roleProfile = await loadRoleProfileForEdge(service, userId);
      const requiredRole = (agent as { required_role?: string | null }).required_role ?? null;
      if (!isAgentAllowedForUserEdge(agent.slug, roleProfile, requiredRole)) {
        return jsonResp({ error: 'You do not have access to this agent' }, 403);
      }
    }

    // 2. Load user personalization (if table exists)
    let personalizationPrompt = '';
    if (userId) {
      try {
        const { data: personalization } = await service
          .from('user_agent_personalizations')
          .select('additional_prompt, tone_preference, communication_style')
          .eq('agent_id', agent.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (personalization?.additional_prompt) {
          personalizationPrompt = `\n\nUser personalization: ${personalization.additional_prompt}`;
        }
      } catch {
        // table may not exist yet — non-fatal
      }
    }

    // 3. Retrieve relevant memories if memory_enabled (L1)
    let memoryBlock = '';
    if (agent.memory_enabled && userId) {
      try {
        const memRes = await fetch(`${supabaseUrl}/functions/v1/retrieve-agent-memories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            agent_id: agent.id,
            user_id: userId,
            query: input,
            limit: 5,
          }),
        });
        if (memRes.ok) {
          const { memories } = await memRes.json() as {
            memories: { content: string; memory_type: string; similarity?: number }[];
          };
          if (memories && memories.length > 0) {
            memoryBlock = '\n\nRelevant memories about this user:\n' +
              memories.map((m, i) => `${i + 1}. [${m.memory_type}] ${m.content}`).join('\n');
          }
        }
      } catch (e) {
        console.warn('run-ai-agent: memory retrieval failed (non-fatal):', e);
      }
    }

    // Per-user customization override (system prompt + extra knowledge entries)
    let customSystemPrompt: string | null = null;
    let customKnowledgeIds: string[] = [];
    if (userId) {
      try {
        const { data: cust } = await service
          .from('user_agent_customizations')
          .select('system_prompt_override, knowledge_entry_ids')
          .eq('agent_id', agent.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (cust) {
          customSystemPrompt =
            typeof cust.system_prompt_override === 'string' && cust.system_prompt_override.trim().length > 0
              ? cust.system_prompt_override
              : null;
          customKnowledgeIds = Array.isArray(cust.knowledge_entry_ids)
            ? (cust.knowledge_entry_ids as unknown[]).filter(
                (x): x is string => typeof x === 'string' && x.length > 0,
              )
            : [];
        }
      } catch (e) {
        console.warn('run-ai-agent: customization lookup failed (non-fatal):', e);
      }
    }

    // Build messages array (system prompt loaded from DB, not from client)
    const baseSystemPrompt = customSystemPrompt ?? agent.system_prompt ?? 'You are a helpful AI assistant.';
    const systemPrompt = baseSystemPrompt + personalizationPrompt;

    let contextBlock = '';
    if (context && Object.keys(context).length > 0) {
      contextBlock = `\n\nContext:\n${JSON.stringify(context, null, 2)}`;
    }

    const fullSystemPrompt = systemPrompt + contextBlock + memoryBlock;

    const history: ChatMessage[] = Array.isArray(conversation_history)
      ? conversation_history.filter((m) => m.role !== 'system')
      : [];

    const messages: ChatMessage[] = [
      { role: 'system', content: fullSystemPrompt },
      ...history,
      { role: 'user', content: input },
    ];

    // Get provider config and call via multi-provider dispatcher (L2)
    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const providerFromConfig =
      typeof providerConfig.provider === 'string'
        ? providerConfig.provider.trim().toLowerCase()
        : '';
    const hasExplicitProvider =
      providerFromConfig === 'lovable' ||
      providerFromConfig === 'openai' ||
      providerFromConfig === 'google' ||
      providerFromConfig === 'anthropic' ||
      providerFromConfig === 'perplexity';

    let resolvedProvider: LlmProvider = hasExplicitProvider
      ? (providerFromConfig as LlmProvider)
      : 'lovable';

    try {
      const { data: integrationRows } = await service
        .from('integration_settings')
        .select('provider_name, api_key, is_active')
        .in('provider_name', ['openai', 'google', 'anthropic', 'perplexity']);

      const lovableReady = !!Deno.env.get('LOVABLE_API_KEY');

      const isReady = (provider: LlmProvider) => {
        if (provider === 'lovable') return lovableReady;
        const row = integrationRows?.find((r) => r.provider_name === provider);
        return !!row?.is_active && !!row?.api_key;
      };

      // Respect explicit provider when it's ready; otherwise fail over (Lovable first).
      if (!isReady(resolvedProvider)) {
        const fallbackOrder: LlmProvider[] = ['lovable', 'google', 'openai', 'anthropic', 'perplexity'];
        const fallback = fallbackOrder.find(isReady);
        if (fallback) {
          resolvedProvider = fallback;
        }
      }
    } catch (providerLookupErr) {
      console.warn('run-ai-agent: provider fallback lookup failed (non-fatal):', providerLookupErr);
    }

    const configuredModel =
      typeof providerConfig.model === 'string' ? providerConfig.model : null;
    const resolvedModel = normalizeModelForProvider(configuredModel, resolvedProvider);

    // Resolve tools for this agent (L3): legacy tools_config array OR metadata.tools toggles
    const metadata = (agent.metadata as Record<string, unknown> | null) ?? {};
    const agentTools = resolveAgentToolsFromMetadata(metadata);

    const knowledgeSearchScope: KnowledgeSearchScope | undefined = (() => {
      const baseEntryIds = Array.isArray(metadata.knowledge_entry_ids)
        ? (metadata.knowledge_entry_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
        : [];
      const entryIds = Array.from(new Set([...baseEntryIds, ...customKnowledgeIds]));
      const categoryIds = Array.isArray(metadata.knowledge_category_ids)
        ? (metadata.knowledge_category_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
        : [];
      if (entryIds.length === 0 && categoryIds.length === 0) return undefined;
      return { entryIds, categoryIds };
    })();

    const builtInToolOptions =
      knowledgeSearchScope && (knowledgeSearchScope.entryIds.length > 0 || knowledgeSearchScope.categoryIds.length > 0)
        ? { knowledgeSearchScope }
        : undefined;

    const t0 = Date.now();
    let outputText: string;
    let usage: Record<string, unknown> | null;
    try {
      // Agentic tool-calling loop — supports up to 5 rounds of tool calls (L3)
      const MAX_TOOL_ROUNDS = 5;
      let round = 0;
      let lastResult = await routedChatCompletion(
        messages,
        {
          ...providerConfig,
          provider: resolvedProvider,
          model: resolvedModel,
          tools: agentTools.length > 0 ? agentTools : undefined,
        },
      );

      while (round < MAX_TOOL_ROUNDS && lastResult.raw) {
        const choice = ((lastResult.raw.choices as Array<{
          finish_reason: string;
          message: {
            role: string;
            content: string | null;
            tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
          };
        }>) ?? [])[0];

        if (choice?.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) break;

        // Append assistant message with tool_calls to the thread
        messages.push({
          role: 'assistant',
          content: choice.message.content ?? null,
          tool_calls: choice.message.tool_calls as ChatMessage['tool_calls'],
        });

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          choice.message.tool_calls.map((tc) => {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments); } catch { /* use empty */ }
            return executeBuiltInTool(tc.id, tc.function.name, args, service, userId, builtInToolOptions);
          }),
        );

        // Append tool result messages
        for (const tr of toolResults) {
          messages.push({ role: 'tool', content: tr.content, tool_call_id: tr.tool_call_id, name: tr.name });
        }

        // Continue the conversation
        lastResult = await routedChatCompletion(
          messages,
          {
            ...providerConfig,
            provider: resolvedProvider,
            model: resolvedModel,
            tools: agentTools.length > 0 ? agentTools : undefined,
          },
        );
        round++;
      }

      outputText = lastResult.output;
      usage = lastResult.usage as Record<string, unknown> | null;
    } catch (aiErr) {
      await logAgentRun({
        supabaseUrl, serviceRoleKey,
        agentId: agent.id, userId,
        input: input.slice(0, 4000),
        output: null, status: 'failed',
        errorMessage: (aiErr as Error).message,
        latencyMs: Date.now() - t0,
        modelUsed: resolvedModel,
        providerUsed: resolvedProvider,
      });
      throw aiErr;
    }

    const latencyMs = Date.now() - t0;

    // 7. Persist conversation thread (M2)
    let conversationId: string | null = existingConvId ?? null;
    try {
      if (userId && !conversationId) {
        // Create a new conversation thread
        const { data: newConv } = await service
          .from('agent_conversations')
          .insert({ agent_id: agent.id, user_id: userId })
          .select('id')
          .single();
        conversationId = newConv?.id ?? null;
      }

      if (userId && conversationId) {
        // Persist the user message and assistant response
        await service.from('agent_messages').insert([
          { conversation_id: conversationId, role: 'user', content: input },
          {
            conversation_id: conversationId,
            role: 'assistant',
            content: outputText,
            model_used: resolvedModel,
            latency_ms: latencyMs,
            token_metrics: usage ?? null,
          },
        ]);
      }
    } catch (convErr) {
      console.warn('run-ai-agent: conversation persistence failed (non-fatal):', convErr);
    }

    // 8. Fire-and-forget memory extraction (L1) — runs async, does not block response
    if (agent.memory_enabled && userId && conversationId) {
      const extractMessages = [
        ...history.slice(-6), // last 3 exchanges for context
        { role: 'user', content: input },
        { role: 'assistant', content: outputText },
      ];
      fetch(`${supabaseUrl}/functions/v1/extract-agent-memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          agent_id: agent.id,
          user_id: userId,
          conversation_id: conversationId,
          messages: extractMessages,
        }),
      }).catch((e: unknown) => console.warn('run-ai-agent: memory extraction fire-and-forget failed:', e));
    }

    // 9. Log to ai_agent_runs
    await logAgentRun({
      supabaseUrl, serviceRoleKey,
      agentId: agent.id, userId,
      input: input.slice(0, 4000),
      output: outputText.slice(0, 8000),
      status: 'completed',
      latencyMs,
      modelUsed: resolvedModel,
      providerUsed: resolvedProvider,
      tokenMetrics: usage ?? null,
      metadata: { agent_slug, context_keys: context ? Object.keys(context) : [], conversation_id: conversationId },
    });

    return new Response(
      JSON.stringify({
        agent_id: agent.id,
        agent_slug: agent.slug,
        agent_name: agent.name,
        output: outputText,
        model_used: resolvedModel,
        provider_used: resolvedProvider,
        latency_ms: latencyMs,
        usage: usage ?? null,
        conversation_id: conversationId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('run-ai-agent error:', err);
    return jsonResp({ error: (err as Error).message || 'Internal server error' }, 500);
  }
});
