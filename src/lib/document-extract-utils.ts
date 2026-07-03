/** Shared types and helpers for parsed knowledge documents. */

export interface DocumentSection {
  title: string | null;
  page: number | null;
  text: string;
}

export interface DocumentTable {
  title?: string;
  rows?: unknown[][];
  [key: string]: unknown;
}

export interface DocumentExtractViewModel {
  id: string;
  knowledge_entry_id: string | null;
  parse_status: string;
  parse_error: string | null;
  word_count: number | null;
  page_count: number | null;
  extracted_text: string | null;
  sections: DocumentSection[];
  tables_json: DocumentTable[];
  file_name: string | null;
  parsed_at: string | null;
  metadata: Record<string, unknown> | null;
}

export function normalizeSections(raw: unknown): DocumentSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const s = item as Record<string, unknown>;
      const text = typeof s.text === "string" ? s.text : "";
      if (!text.trim()) return null;
      return {
        title: typeof s.title === "string" ? s.title : null,
        page: typeof s.page === "number" ? s.page : null,
        text,
      };
    })
    .filter((s): s is DocumentSection => s !== null);
}

export function normalizeTables(raw: unknown): DocumentTable[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t) => t && typeof t === "object") as DocumentTable[];
}

export function buildExtractExportPayload(extract: DocumentExtractViewModel) {
  return {
    file_name: extract.file_name,
    parse_status: extract.parse_status,
    word_count: extract.word_count,
    page_count: extract.page_count,
    parsed_at: extract.parsed_at,
    metadata: extract.metadata,
    extracted_text: extract.extracted_text,
    sections: extract.sections,
    tables_json: extract.tables_json,
  };
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function toExtractViewModel(row: {
  id: string;
  knowledge_entry_id: string | null;
  parse_status: string;
  parse_error?: string | null;
  word_count?: number | null;
  page_count?: number | null;
  extracted_text?: string | null;
  sections?: unknown;
  tables_json?: unknown;
  file_name?: string | null;
  parsed_at?: string | null;
  metadata?: unknown;
}): DocumentExtractViewModel {
  return {
    id: row.id,
    knowledge_entry_id: row.knowledge_entry_id,
    parse_status: row.parse_status,
    parse_error: row.parse_error ?? null,
    word_count: row.word_count ?? null,
    page_count: row.page_count ?? null,
    extracted_text: row.extracted_text ?? null,
    sections: normalizeSections(row.sections),
    tables_json: normalizeTables(row.tables_json),
    file_name: row.file_name ?? null,
    parsed_at: row.parsed_at ?? null,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
}

/** Poll until document_extracts row reaches a terminal state or timeout. */
export async function waitForDocumentExtract(
  knowledgeEntryId: string,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<DocumentExtractViewModel | null> {
  const { supabase } = await import("@/lib/supabase");
  const maxAttempts = options?.maxAttempts ?? 20;
  const intervalMs = options?.intervalMs ?? 1500;

  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase
      .from("document_extracts")
      .select(
        "id, knowledge_entry_id, parse_status, parse_error, word_count, page_count, extracted_text, sections, tables_json, file_name, parsed_at, metadata",
      )
      .eq("knowledge_entry_id", knowledgeEntryId)
      .maybeSingle();

    if (error) {
      console.warn("waitForDocumentExtract:", error.message);
      return null;
    }

    if (data) {
      const model = toExtractViewModel(data as Parameters<typeof toExtractViewModel>[0]);
      if (model.parse_status === "done" || model.parse_status === "error") {
        return model;
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null;
}
