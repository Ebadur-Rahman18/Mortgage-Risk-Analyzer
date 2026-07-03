/**
 * retrieve-agent-memories — Retrieves semantically relevant memories for an
 * agent + user pair given a query string. Uses pgvector cosine similarity
 * search via the search_agent_memories RPC.
 *
 * POST {
 *   agent_id:      string,              // UUID of the AI agent
 *   user_id:       string,              // UUID of the user
 *   query:         string,              // current user input to match against
 *   limit?:        number,              // max memories to return (default 5)
 *   memory_types?: ('short_term' | 'long_term')[],  // default both
 * }
 *
 * Returns: { memories: Array<{ id, content, memory_type, importance_score, similarity }> }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResp, getOpenAIApiKey } from '../_shared/ai-utils.ts';

type RetrievedMemory = {
  id: string;
  content: string;
  memory_type: string;
  importance_score: number | null;
  similarity?: number | null;
  created_at?: string;
};

async function embedQuery(apiKey: string, query: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: query.slice(0, 8192) }),
    });
    if (!res.ok) {
      console.error('embed query error:', await res.text());
      return null;
    }
    const data = await res.json() as { data: { embedding: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error('embedQuery error:', e);
    return null;
  }
}

function rankMemories(memories: RetrievedMemory[], limit: number): RetrievedMemory[] {
  return [...memories]
    .sort((a, b) => {
      const similarityDiff = (b.similarity ?? -1) - (a.similarity ?? -1);
      if (similarityDiff !== 0) return similarityDiff;

      const importanceDiff = (b.importance_score ?? 0) - (a.importance_score ?? 0);
      if (importanceDiff !== 0) return importanceDiff;

      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bCreated - aCreated;
    })
    .slice(0, Math.max(1, limit));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResp({ error: 'Missing Supabase configuration' }, 500);
  }

  // Accept service-role-key (internal) or user JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRole) {
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResp({ error: 'Unauthorized' }, 401);
    }
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await anonClient.auth.getUser();
    if (error || !user) {
      return jsonResp({ error: 'Invalid session' }, 401);
    }
  }

  try {
    const body = await req.json().catch(() => ({})) as {
      agent_id?: string;
      user_id?: string;
      query?: string;
      limit?: number;
      memory_types?: ('short_term' | 'long_term')[];
    };

    const { agent_id, user_id, query, limit = 5, memory_types = ['short_term', 'long_term'] } = body;

    if (!agent_id || !user_id || !query?.trim()) {
      return jsonResp({ error: 'agent_id, user_id, and query are required' }, 400);
    }

    const apiKey = await getOpenAIApiKey();
    const service = createClient(supabaseUrl, serviceRoleKey);

    // Always pull recent memories as fallback + supplement.
    const recentWindowIso = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
    const { data: recentMemories, error: recentErr } = await service
      .from('agent_memories')
      .select('id, content, memory_type, importance_score, created_at')
      .eq('agent_id', agent_id)
      .eq('user_id', user_id)
      .in('memory_type', memory_types)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .gte('created_at', recentWindowIso)
      .order('created_at', { ascending: false })
      .order('importance_score', { ascending: false })
      .limit(limit * 2);

    if (recentErr) {
      console.error('Recent memory lookup failed:', recentErr);
      return jsonResp({ error: 'Memory retrieval failed', details: recentErr.message }, 500);
    }

    let semanticMemories: RetrievedMemory[] = [];
    let usedSemantic = false;

    if (apiKey) {
      const queryEmbedding = await embedQuery(apiKey, query);
      if (queryEmbedding) {
        const { data: semanticData, error: rpcErr } = await service.rpc('search_agent_memories', {
          p_agent_id: agent_id,
          p_user_id: user_id,
          p_query_embedding: `[${queryEmbedding.join(',')}]`,
          p_limit: limit,
          p_memory_types: memory_types,
        });

        if (rpcErr) {
          console.error('search_agent_memories RPC error:', rpcErr);
        } else {
          semanticMemories = (semanticData ?? []) as RetrievedMemory[];
          usedSemantic = true;
        }
      } else {
        console.warn('retrieve-agent-memories: query embedding failed; using recency fallback only.');
      }
    } else {
      console.warn('retrieve-agent-memories: OpenAI key missing; using recency fallback only.');
    }

    // Combine semantic + recent and dedupe by id.
    const mergedMap = new Map<string, RetrievedMemory>();
    for (const m of semanticMemories) {
      mergedMap.set(m.id, m);
    }
    for (const m of ((recentMemories ?? []) as RetrievedMemory[])) {
      if (!mergedMap.has(m.id)) mergedMap.set(m.id, { ...m, similarity: null });
    }

    const finalMemories = rankMemories(Array.from(mergedMap.values()), limit);

    if (finalMemories.length > 0) {
      const ids = finalMemories.map((m) => m.id);
      const { error: incrementErr } = await service.rpc('increment_memory_access', {
        p_memory_ids: ids,
      });
      if (incrementErr) {
        // Fallback keeps timestamp current even if increment RPC is not available.
        console.warn('increment_memory_access RPC failed; falling back to timestamp-only update.', incrementErr.message);
        service
          .from('agent_memories')
          .update({ last_accessed_at: new Date().toISOString() })
          .in('id', ids)
          .catch(() => {});
      }
    }

    return jsonResp({ memories: finalMemories, semantic: usedSemantic });
  } catch (err) {
    console.error('retrieve-agent-memories error:', err);
    return jsonResp({ error: (err as Error).message || 'Internal server error' }, 500);
  }
});
