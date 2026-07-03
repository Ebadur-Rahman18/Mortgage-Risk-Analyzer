/**
 * parse-document — Universal document ingestion for Knowledge / loan uploads.
 * Formats: PDF (pdf-parse), DOCX, XLSX, PPTX, TXT, MD, JSON.
 * POST { knowledge_entry_id: string, storage_bucket?: "user-knowledge" | "loan-borrower-uploads" }
 * Authorization: Bearer <jwt>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResp } from '../_shared/ai-utils.ts';
import { assertStaffCanAccessLoan } from '../_shared/staff-loan-access.ts';
import { extractPdfText } from '../_shared/pdf-text-extract.ts';

const MAX_CONTENT_CHARS = 1_200_000;
const BUCKET_DEFAULT = 'user-knowledge';
const ALLOWED_BUCKETS = ['user-knowledge', 'loan-borrower-uploads'] as const;

interface KnowledgeMetadata {
  file_path?: string;
  file_name?: string;
  file_type?: string;
  file_url?: string;
  mime_type?: string;
  storage_bucket?: string;
}

function scheduleGenerateEmbeddings(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string | null,
  knowledgeEntryId: string,
  text: string,
): void {
  if (!authHeader || !text.trim()) return;
  const url = `${supabaseUrl}/functions/v1/generate-embeddings`;
  const p = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      apikey: anonKey,
    },
    body: JSON.stringify({
      entity_type: 'knowledge_entry',
      entity_id: knowledgeEntryId,
      content: text.slice(0, 8000),
    }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const t = await r.text();
        console.warn('generate-embeddings:', r.status, t);
      }
    })
    .catch((e) => console.warn('generate-embeddings trigger:', e));

  const edge = (globalThis as Record<string, unknown>)['EdgeRuntime'] as
    | { waitUntil?: (x: Promise<unknown>) => void }
    | undefined;
  edge?.waitUntil?.(p);
}

async function loadRoleFlags(service: ReturnType<typeof createClient>, userId: string) {
  const { data: ur } = await service.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return { isStaff: ur?.role === 'admin' || ur?.role === 'moderator', appRole: ur?.role ?? 'user' };
}

async function parseBytes(
  bytes: Uint8Array,
  mime: string,
  fileName: string,
): Promise<{
  text: string;
  pageCount: number | null;
  sections: Array<{ title: string | null; page: number | null; text: string }>;
  tablesJson: unknown[];
  extraMeta: Record<string, unknown>;
}> {
  const lower = fileName.toLowerCase();
  const effectiveMime = mime || 'application/octet-stream';

  if (effectiveMime === 'application/msword' || lower.endsWith('.doc')) {
    throw new Error(
      'Legacy .doc files are not supported. Save as .docx and upload again.',
    );
  }

  if (
    effectiveMime === 'text/plain' ||
    effectiveMime === 'text/markdown' ||
    lower.endsWith('.md') ||
    lower.endsWith('.txt')
  ) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return {
      text,
      pageCount: null,
      sections: [{ title: 'Document', page: null, text }],
      tablesJson: [],
      extraMeta: {},
    };
  }

  if (effectiveMime === 'application/json' || lower.endsWith('.json')) {
    try {
      const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const parsed = JSON.parse(raw);
      const text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
      return {
        text,
        pageCount: null,
        sections: [{ title: 'JSON', page: null, text }],
        tablesJson: [],
        extraMeta: {},
      };
    } catch {
      throw new Error('Invalid JSON file');
    }
  }

  if (
    effectiveMime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    const mammoth = await import('https://esm.sh/mammoth@1.8.0');
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
    const text = value ?? '';
    return {
      text,
      pageCount: null,
      sections: [{ title: 'Document', page: null, text }],
      tablesJson: [],
      extraMeta: { parser: 'mammoth' },
    };
  }

  if (
    effectiveMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    lower.endsWith('.xlsx')
  ) {
    const XLSX = await import('https://esm.sh/xlsx@0.18.5');
    const wb = XLSX.read(bytes, { type: 'array' });
    const parts: string[] = [];
    const tablesJson: unknown[] = [];
    for (const name of wb.SheetNames ?? []) {
      const sheet = wb.Sheets[name];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet);
      parts.push(`## ${name}\n${csv}`);
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      tablesJson.push({ title: name, rows });
    }
    const text = parts.join('\n\n');
    return {
      text,
      pageCount: wb.SheetNames?.length ?? null,
      sections: [{ title: 'Workbook', page: null, text }],
      tablesJson,
      extraMeta: { parser: 'xlsx', sheets: wb.SheetNames ?? [] },
    };
  }

  if (
    effectiveMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    lower.endsWith('.pptx')
  ) {
    const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const zip = await JSZip.loadAsync(ab);
    const slideNames = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)/i)?.[1] ?? '0', 10);
        const nb = parseInt(b.match(/slide(\d+)/i)?.[1] ?? '0', 10);
        return na - nb;
      });

    const slideBodies: string[] = [];
    for (const name of slideNames) {
      const f = zip.file(name);
      if (!f) continue;
      const xml = await f.async('string');
      const stripped = xml
        .replace(/<a:t>/g, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (stripped.length) slideBodies.push(stripped);
    }

    const text = slideBodies.join('\n\n').trim();
    const sections = slideBodies.length
      ? slideBodies.map((body, i) => ({ title: `Slide ${i + 1}`, page: i + 1, text: body }))
      : [{ title: 'Presentation', page: null, text: text || '(no extractable text in slides)' }];

    return {
      text: text || '(no extractable text in slides)',
      pageCount: slideNames.length || null,
      sections,
      tablesJson: [],
      extraMeta: { parser: 'pptx', slides: slideNames.length },
    };
  }

  if (effectiveMime === 'application/pdf' || lower.endsWith('.pdf')) {
    try {
      const pdfResult = await extractPdfText(bytes);
      if (!pdfResult.text.trim()) {
        throw new Error('No extractable text in PDF');
      }
      return {
        text: pdfResult.text,
        pageCount: pdfResult.pageCount,
        sections: pdfResult.sections,
        tablesJson: [],
        extraMeta: pdfResult.extraMeta,
      };
    } catch (e) {
      console.error('PDF parse failed:', (e as Error)?.message ?? e);
      throw new Error('PDF text extraction failed. Ensure the file is a text-based PDF.');
    }
  }

  throw new Error(
    `Unsupported type: ${effectiveMime}. Supported: PDF, DOCX, XLSX, PPTX, TXT, MD, JSON.`,
  );
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
  const authorizationHeader = authHeader;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }
  const userId = userData.user.id;

  const service = createClient(supabaseUrl, serviceRoleKey);

  let body: { knowledge_entry_id?: string; storage_bucket?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: 'Invalid JSON body' }, 400);
  }

  const knowledgeEntryId = body.knowledge_entry_id?.trim();
  if (!knowledgeEntryId) {
    return jsonResp({ error: 'knowledge_entry_id is required' }, 400);
  }

  const { data: entry, error: entryErr } = await service
    .from('knowledge_entries')
    .select('id, author_id, created_by, metadata, title, content')
    .eq('id', knowledgeEntryId)
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

  const meta = (entry.metadata ?? {}) as KnowledgeMetadata;
  const storagePath = meta.file_path?.trim();
  if (!storagePath) {
    return jsonResp({ error: 'No file_path on knowledge entry metadata' }, 400);
  }

  const requestedBucket = typeof body.storage_bucket === 'string' ? body.storage_bucket.trim() : '';
  const metaBucket = typeof meta.storage_bucket === 'string' ? meta.storage_bucket.trim() : '';
  const storageBucket = (requestedBucket || metaBucket || BUCKET_DEFAULT).toLowerCase();

  if (!ALLOWED_BUCKETS.includes(storageBucket as (typeof ALLOWED_BUCKETS)[number])) {
    return jsonResp(
      { error: `Invalid storage_bucket. Allowed: ${ALLOWED_BUCKETS.join(', ')}` },
      400,
    );
  }

  if (storageBucket === 'loan-borrower-uploads') {
    const { data: uploadRow, error: upErr } = await service
      .from('loan_borrower_uploads')
      .select('loan_id')
      .eq('storage_path', storagePath)
      .maybeSingle();

    if (upErr) {
      console.error('loan_borrower_uploads lookup:', upErr.message);
      return jsonResp({ error: 'Upload lookup failed' }, 500);
    }
    if (!uploadRow?.loan_id) {
      return jsonResp({ error: 'File not found for this storage path' }, 404);
    }

    const access = await assertStaffCanAccessLoan(userClient, service, userId, uploadRow.loan_id);
    if (!access.ok) {
      return jsonResp({ error: access.message }, access.status);
    }
  }

  const fileName = meta.file_name || storagePath.split('/').pop() || 'document';
  const mimeHint = meta.mime_type || meta.file_type || '';

  const { data: fileData, error: dlErr } = await service.storage.from(storageBucket).download(storagePath);
  if (dlErr || !fileData) {
    console.error('Storage download error:', dlErr?.message);
    return jsonResp({ error: 'Failed to download file from storage' }, 500);
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  let parsed: Awaited<ReturnType<typeof parseBytes>>;
  try {
    parsed = await parseBytes(bytes, mimeHint, fileName);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Parse failed';
    await service.from('document_extracts').delete().eq('knowledge_entry_id', knowledgeEntryId);
    await service.from('document_extracts').insert({
      knowledge_entry_id: knowledgeEntryId,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeHint || null,
      byte_size: bytes.byteLength,
      parse_status: 'error',
      parse_error: msg,
      uploaded_by: userId,
    });
    const errMeta = {
      ...(entry.metadata as Record<string, unknown> ?? {}),
      storage_bucket: storageBucket,
      parse_status: 'error',
      parse_error: msg,
      has_extracted_content: false,
    };
    await service.from('knowledge_entries').update({ metadata: errMeta }).eq('id', knowledgeEntryId);
    return jsonResp({ error: msg, parse_status: 'error' }, 422);
  }

  const text = parsed.text.slice(0, MAX_CONTENT_CHARS);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  await service.from('document_extracts').delete().eq('knowledge_entry_id', knowledgeEntryId);

  const { data: extractRow, error: insErr } = await service
    .from('document_extracts')
    .insert({
      knowledge_entry_id: knowledgeEntryId,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeHint || null,
      byte_size: bytes.byteLength,
      parse_status: 'done',
      parse_error: null,
      page_count: parsed.pageCount,
      word_count: wordCount,
      extracted_text: text,
      sections: parsed.sections,
      tables_json: parsed.tablesJson,
      metadata: { ...parsed.extraMeta, file_name: fileName },
      parsed_at: new Date().toISOString(),
      uploaded_by: userId,
    })
    .select('id')
    .single();

  if (insErr) {
    console.error('document_extracts insert:', insErr.message);
    return jsonResp({ error: 'Failed to save parse result' }, 500);
  }

  const nextMeta = {
    ...(entry.metadata as Record<string, unknown> ?? {}),
    storage_bucket: storageBucket,
    parse_status: 'done',
    document_extract_id: extractRow?.id,
    parser: (parsed.extraMeta as { parser?: string }).parser ?? 'text',
    word_count: wordCount,
    page_count: parsed.pageCount,
    has_extracted_content: true,
  };

  const { error: upErr } = await service
    .from('knowledge_entries')
    .update({
      content: text,
      metadata: nextMeta,
    })
    .eq('id', knowledgeEntryId);

  if (upErr) {
    console.error('knowledge_entries update:', upErr.message);
    return jsonResp({ error: 'Parsed but failed to update knowledge entry' }, 500);
  }

  scheduleGenerateEmbeddings(supabaseUrl, anonKey, authorizationHeader, knowledgeEntryId, text);

  return jsonResp({
    ok: true,
    document_extract_id: extractRow?.id,
    word_count: wordCount,
    page_count: parsed.pageCount,
    chars: text.length,
  });
});
