/**
 * extract-agent-memories — Extracts and persists key facts from a conversation
 * into the agent_memories table for later retrieval.
 *
 * Designed to be called fire-and-forget from run-ai-agent after a response is
 * returned to the user, so it never blocks the chat UX.
 *
 * POST {
 *   agent_id:        string,   // UUID of the AI agent
 *   user_id:         string,   // UUID of the user
 *   conversation_id: string,   // UUID of the conversation thread
 *   messages:        Array<{ role: string, content: string }>,
 *   memory_type?:    'short_term' | 'long_term',  // optional fallback override for all extracted memories
 * }
 *
 * The function is expected to be called with the service role key so it can
 * insert memories on behalf of any user (JWT is validated separately).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResp, getOpenAIApiKey } from '../_shared/ai-utils.ts';

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction assistant. Your job is to extract 1-5 important, reusable facts from a conversation that would be valuable to remember about this user for future interactions.

Focus on:
- User preferences (tone, detail level, format preferences)
- Domain-specific facts the user shared (loan details, business context)
- Recurring concerns or priorities
- Personal or professional context that affects how to respond
- Concrete user-stated facts (e.g., favorite things, places visited, upcoming events, decisions made)

Important:
- If the user clearly states a personal fact ("I went to Italy", "my favorite color is orange"),
  extract it as memory instead of dropping it.
- For travel/location/event facts, prefer "short_term" unless it appears as a durable preference.

Each memory should be a single, concise sentence (max 120 chars).
Assign memory_type using these rules:
- Use "long_term" for durable preferences, stable profile facts, recurring priorities, or ongoing professional context likely useful across many future chats.
- Use "short_term" for temporary details, one-off tasks, session-bound context, or facts likely to become stale quickly.
Reply ONLY with a JSON array of objects with this exact shape:
[
  {"content":"User prefers bullet-point summaries over paragraphs.","importance_score":0.82,"memory_type":"long_term"},
  {"content":"User is preparing a weekly branch report due tomorrow.","importance_score":0.68,"memory_type":"short_term"}
]

importance_score must be a number between 0.5 and 1.0.

If no memories are worth extracting, return an empty array: []`;

type ExtractedMemory = {
  content: string;
  importance_score: number;
  memory_type: 'short_term' | 'long_term';
};

function clampImportance(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.max(0.5, Math.min(1.0, value));
}

function coerceMemoryType(value: unknown, fallback: 'short_term' | 'long_term'): 'short_term' | 'long_term' {
  return value === 'long_term' ? 'long_term' : fallback;
}

async function embedTexts(apiKey: string, texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
    });
    if (!res.ok) {
      console.error('embed error:', await res.text());
      return texts.map(() => null);
    }
    const data = await res.json() as { data: { index: number; embedding: number[] }[] };
    const result: (number[] | null)[] = texts.map(() => null);
    for (const item of data.data) {
      result[item.index] = item.embedding;
    }
    return result;
  } catch (e) {
    console.error('embedTexts error:', e);
    return texts.map(() => null);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResp({ error: 'Missing Supabase configuration' }, 500);
  }

  // This function is called internally (fire-and-forget from run-ai-agent).
  // Accept either service-role-key header auth or bearer token.
  const authHeader = req.headers.get('Authorization') ?? '';
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  if (!isServiceRole) {
    // Validate as normal user JWT
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!anonKey || !authHeader.startsWith('Bearer ')) {
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
      conversation_id?: string;
      messages?: { role: string; content: string }[];
      memory_type?: 'short_term' | 'long_term';
    };

    const { agent_id, user_id, conversation_id, messages, memory_type } = body;
    const defaultMemoryType: 'short_term' | 'long_term' = memory_type ?? 'short_term';

    if (!agent_id || !user_id || !messages || messages.length === 0) {
      return jsonResp({ error: 'agent_id, user_id, and messages are required' }, 400);
    }

    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
      return jsonResp({ error: 'OpenAI API key not configured' }, 401);
    }

    // Build conversation summary for extraction
    const conversationText = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
      .slice(0, 8000);

    // Extract memories via OpenAI
    const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 512,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: `Extract memories from this conversation:\n\n${conversationText}` },
        ],
      }),
    });

    if (!extractRes.ok) {
      const errText = await extractRes.text();
      console.error('OpenAI extraction error:', errText);
      return jsonResp({ error: 'Memory extraction failed', details: errText }, 500);
    }

    const extractData = await extractRes.json();
    const rawContent = extractData.choices?.[0]?.message?.content ?? '[]';

    let extractedMemories: ExtractedMemory[] = [];
    try {
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          extractedMemories = parsed
            .map((m): ExtractedMemory | null => {
              if (!m || typeof m !== 'object') return null;
              const content = typeof (m as { content?: unknown }).content === 'string'
                ? (m as { content: string }).content.trim()
                : '';
              if (!content) return null;
              return {
                content: content.slice(0, 120),
                importance_score: clampImportance((m as { importance_score?: unknown }).importance_score),
                memory_type: coerceMemoryType((m as { memory_type?: unknown }).memory_type, defaultMemoryType),
              };
            })
            .filter((m): m is ExtractedMemory => m !== null)
            .slice(0, 5);
        }
      }
    } catch {
      console.warn('Failed to parse memory extraction output:', rawContent);
    }

    // Backward-compatibility fallback: if model returned plain string array, recover gracefully.
    if (extractedMemories.length === 0) {
      try {
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            extractedMemories = parsed
              .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
              .slice(0, 5)
              .map((content) => ({
                content: content.trim().slice(0, 120),
                importance_score: 0.5,
                memory_type: defaultMemoryType,
              }));
          }
        }
      } catch {
        // no-op: leave as empty
      }
    }

    if (extractedMemories.length === 0) {
      return jsonResp({ extracted: 0, message: 'No memories to extract from this conversation.' });
    }

    // Deduplicate near-identical memories to reduce noise accumulation.
    const seen = new Set<string>();
    extractedMemories = extractedMemories.filter((m) => {
      const key = m.content.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Embed all memories in a single batch call
    const embeddings = await embedTexts(apiKey, extractedMemories.map((m) => m.content));

    const service = createClient(supabaseUrl, serviceRoleKey);

    const rows = extractedMemories.map((memory, i) => ({
      agent_id,
      user_id,
      conversation_id: conversation_id ?? null,
      memory_type: memory.memory_type,
      content: memory.content,
      embedding: embeddings[i] ? `[${embeddings[i]!.join(',')}]` : null,
      importance_score: memory.importance_score,
      expires_at: memory.memory_type === 'short_term'
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
    }));

    const { error: insertErr } = await service.from('agent_memories').insert(rows);
    if (insertErr) {
      console.error('Memory insert error:', insertErr);
      return jsonResp({ error: 'Failed to persist memories', details: insertErr.message }, 500);
    }

    return jsonResp({
      extracted: extractedMemories.length,
      memory_breakdown: {
        short_term: extractedMemories.filter((m) => m.memory_type === 'short_term').length,
        long_term: extractedMemories.filter((m) => m.memory_type === 'long_term').length,
      },
    });
  } catch (err) {
    console.error('extract-agent-memories error:', err);
    return jsonResp({ error: (err as Error).message || 'Internal server error' }, 500);
  }
});
