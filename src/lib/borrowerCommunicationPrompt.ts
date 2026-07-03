/**
 * Client-side helpers aligned with supabase/functions/_shared/borrower-comm-prompt.ts
 * (prompt contract + JSON parsing for tests and UI validation).
 */

export const BORROWER_COMMUNICATION_DOC_TYPES = [
  { value: "status_update", label: "Borrower status update" },
  { value: "condition_request", label: "Condition request" },
  { value: "escalation_note", label: "Internal escalation note" },
  { value: "closing_notification", label: "Closing notification" },
  { value: "realtor_update", label: "Realtor update" },
  { value: "rate_lock_reminder", label: "Rate lock reminder" },
] as const;

export interface DraftParseResult {
  draft_content: string;
  missing_data_notes: string[];
  confidence: string;
}

export function normalizeGeneratedDraftContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse model JSON output (same rules as edge shared helper). */
export function parseOpenAiDraftJson(raw: string): DraftParseResult | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
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
      typeof parsed.draft_content === "string" ? parsed.draft_content : "",
    );
    const missing_data_notes = Array.isArray(parsed.missing_data_notes)
      ? (parsed.missing_data_notes as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const confidence =
      typeof parsed.confidence === "string" ? parsed.confidence : "medium";
    if (!draft_content) return null;
    return { draft_content, missing_data_notes, confidence };
  } catch {
    return null;
  }
}
