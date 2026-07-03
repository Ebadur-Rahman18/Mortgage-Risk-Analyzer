/**
 * generate-embeddings — Create a text embedding and optionally persist on document_extracts.
 * POST body (knowledge entries): { entity_type: "knowledge_entry", entity_id: uuid, content | text: string }
 * POST body (generic / tests): { entity_type: "test" | other, entity_id: string, content | text: string } — no DB write
 * Authorization: Bearer <jwt>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResp, getOpenAIApiKey } from '../_shared/ai-utils.ts';

const MAX_INPUT_CHARS = 8000;

async function loadRoleFlags(service: ReturnType<typeof createClient>, userId: string) {
  const { data: ur } = await service.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return { isStaff: ur?.role === 'admin' || ur?.role === 'moderator', appRole: ur?.role ?? 'user' };
}

async function embedOpenAI(apiKey: string, input: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: input.slice(0, 8192),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `OpenAI embeddings HTTP ${res.status}`);
  }
  const data = (await res.json()) as { data?: { embedding: number[] }[] };
  const vec = data.data?.[0]?.embedding;
  if (!vec?.length) throw new Error('Empty embedding from OpenAI');
  return vec;
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

  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }
  const userId = userData.user.id;

  let body: {
    entity_type?: string;
    entity_id?: string;
    content?: string;
    text?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: 'Invalid JSON body' }, 400);
  }

  const entityType = (body.entity_type ?? '').trim();
  const entityId = (body.entity_id ?? '').trim();
  let rawText = (body.content ?? body.text ?? '').trim();

  if (!entityType || !entityId) {
    return jsonResp({ error: 'entity_type and entity_id are required' }, 400);
  }

  const service = createClient(supabaseUrl, serviceRoleKey);

  if (entityType === 'knowledge_entry') {
    const { data: extractRow } = await service
      .from('document_extracts')
      .select('extracted_text')
      .eq('knowledge_entry_id', entityId)
      .eq('parse_status', 'done')
      .maybeSingle();

    const fromDb = (extractRow as { extracted_text?: string | null } | null)?.extracted_text?.trim();
    if (fromDb) rawText = fromDb;
  }

  if (!rawText) {
    return jsonResp({ error: 'content or text is required' }, 400);
  }

  const text = rawText.slice(0, MAX_INPUT_CHARS);

  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return jsonResp({ error: 'Embedding provider not configured' }, 503);
  }

  let embedding: number[];
  try {
    embedding = await embedOpenAI(apiKey, text);
  } catch (e) {
    console.error('generate-embeddings:', (e as Error)?.message ?? e);
    return jsonResp({ error: (e as Error).message || 'Embedding failed' }, 502);
  }

  if (entityType === 'knowledge_entry') {
    const { data: entry, error: entryErr } = await service
      .from('knowledge_entries')
      .select('id, author_id, created_by')
      .eq('id', entityId)
      .maybeSingle();

    if (entryErr || !entry) {
      return jsonResp({ error: 'Knowledge entry not found' }, 404);
    }

    const authorId = (entry as { author_id?: string | null }).author_id;
    const createdBy = (entry as { created_by?: string | null }).created_by;
    const { isStaff } = await loadRoleFlags(service, userId);
    const ownerId = authorId ?? createdBy;
    if (!isStaff && ownerId !== userId) {
      return jsonResp({ error: 'Forbidden' }, 403);
    }

    const literal = `[${embedding.join(',')}]`;
    const { data: updated, error: upErr } = await service
      .from('document_extracts')
      .update({ content_embedding: literal })
      .eq('knowledge_entry_id', entityId)
      .eq('parse_status', 'done')
      .select('id');

    if (upErr) {
      console.error('document_extracts embedding update:', upErr.message);
      return jsonResp({ error: 'Failed to store embedding' }, 500);
    }

    return jsonResp({
      ok: true,
      entity_type: entityType,
      entity_id: entityId,
      dimensions: embedding.length,
      updated_rows: updated?.length ?? 0,
    });
  }

  return jsonResp({
    ok: true,
    entity_type: entityType,
    entity_id: entityId,
    dimensions: embedding.length,
  });
});
