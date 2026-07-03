import { formatDate } from "@/lib/utils";

type KnowledgeEntryDateSource = {
  created_at: string;
  metadata?: unknown;
  author_id?: string | null;
};

/** Demo day: uploads on 2026-06-18 UTC show as May 18; from 2026-06-19 onward use real created_at. */
function isJune18DemoUpload(createdAt: string): boolean {
  const d = new Date(createdAt);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === 2026 &&
    d.getUTCMonth() === 5 &&
    d.getUTCDate() === 18
  );
}

function toDemoMay18Display(createdAt: string): string {
  const created = new Date(createdAt);
  const may = new Date(created);
  may.setUTCMonth(4);
  may.setUTCDate(18);
  return may.toISOString();
}

/** display_date override, demo May 18 for 2026-06-18 uploads, else real created_at. */
export function getKnowledgeEntryDisplayDate(entry: KnowledgeEntryDateSource): string {
  const meta = entry.metadata as { display_date?: string } | null | undefined;
  const override = meta?.display_date?.trim();
  if (override) return override;

  if (isJune18DemoUpload(entry.created_at)) {
    return toDemoMay18Display(entry.created_at);
  }

  return entry.created_at;
}

export function formatKnowledgeEntryDate(entry: KnowledgeEntryDateSource): string {
  return formatDate(getKnowledgeEntryDisplayDate(entry));
}

export function canManageKnowledgeEntry(
  userId: string | undefined,
  userRole: string | null | undefined,
  entry: { author_id?: string | null; created_by?: string | null } | null | undefined,
): boolean {
  if (!userId || !entry) return false;
  if (userRole === "admin") return true;
  return entry.author_id === userId;
}
