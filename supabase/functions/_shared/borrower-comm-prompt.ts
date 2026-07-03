/**
 * Shared helpers for document-generation draft generation (Deno edge).
 */

export const DOCUMENT_GENERATION_AGENT_SLUG = 'document-generation-agent';

export const ALLOWED_DOC_TYPES = new Set([
  'status_update',
  'condition_request',
  'escalation_note',
  'closing_notification',
  'realtor_update',
  'rate_lock_reminder',
]);

export interface DraftParseResult {
  draft_content: string;
  missing_data_notes: string[];
  confidence: string;
}

function normalizeGeneratedDraftContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildUserMessageForDraft(params: {
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

export function parseOpenAiDraftJson(raw: string): DraftParseResult | null {
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
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const draft_content = normalizeGeneratedDraftContent(
      typeof parsed.draft_content === 'string' ? parsed.draft_content : '',
    );
    const missing_data_notes = Array.isArray(parsed.missing_data_notes)
      ? (parsed.missing_data_notes as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    const confidence =
      typeof parsed.confidence === 'string' ? parsed.confidence : 'medium';
    if (!draft_content) return null;
    return { draft_content, missing_data_notes, confidence };
  } catch {
    return null;
  }
}
