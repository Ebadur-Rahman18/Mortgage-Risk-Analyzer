import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";
import { getCalendarEvents, type OutlookCalendarEvent } from "@/lib/microsoftTeamsMeetingService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meetingsTable = () => (supabase as any).from("meetings");

export type CalendarSourceKey =
  | "milestones"
  | "locks"
  | "meetings"
  | "conditions"
  | "actionItems"
  | "outlook";

export type CalendarEventKind =
  | "milestone_due"
  | "milestone_completed"
  | "loan_lock"
  | "rate_lock"
  | "meeting"
  | "borrower_appointment"
  | "condition"
  | "action_item"
  | "outlook";

export interface UnifiedCalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  subtitle?: string;
  start: string;
  end?: string;
  allDay: boolean;
  loanId?: string;
  loanNumber?: string;
  meetingId?: string;
  conditionId?: string;
  actionItemId?: string;
  rateLockId?: string;
  deepLink: string;
}

export const DEFAULT_CALENDAR_SOURCES: Record<CalendarSourceKey, boolean> = {
  milestones: true,
  locks: true,
  meetings: true,
  conditions: true,
  actionItems: true,
  outlook: false,
};

export interface UseUnifiedCalendarOptions {
  rangeStart: Date;
  rangeEnd: Date;
  sources: Record<CalendarSourceKey, boolean>;
  includeOutlook: boolean;
  enabled?: boolean;
}

function sortEvents(a: UnifiedCalendarEvent, b: UnifiedCalendarEvent): number {
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

function toDateOnlyISO(d: string): string {
  return d.length >= 10 ? d.slice(0, 10) : d;
}

export function outlookToUnified(ev: OutlookCalendarEvent): UnifiedCalendarEvent {
  const start = ev.start?.dateTime ?? "";
  const end = ev.end?.dateTime;
  const join = ev.onlineMeeting?.joinUrl;
  const href = ev.webLink || join;
  return {
    id: `outlook-${ev.id}`,
    kind: "outlook",
    title: ev.subject || "(No title)",
    subtitle: ev.location?.displayName,
    start,
    end,
    allDay: !!ev.isAllDay,
    deepLink: href || "#",
  };
}

export async function fetchUnifiedCalendarEvents(
  options: UseUnifiedCalendarOptions,
): Promise<UnifiedCalendarEvent[]> {
  const { rangeStart, rangeEnd, sources, includeOutlook } = options;
  const fromStr = format(rangeStart, "yyyy-MM-dd");
  const toStr = format(rangeEnd, "yyyy-MM-dd");
  const fromISO = rangeStart.toISOString();
  const toISO = rangeEnd.toISOString();

  const events: UnifiedCalendarEvent[] = [];
  const tasks: Promise<void>[] = [];

  // ── Milestones (due dates in range) ─────────────────────────────────────
  if (sources.milestones) {
    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from("loan_milestones")
          .select("id, loan_id, name, milestone_type, due_date, completed_at, loans(loan_number)")
          .not("due_date", "is", null)
          .gte("due_date", fromStr)
          .lte("due_date", toStr);
        if (error) {
          console.warn("[calendar] milestones due:", error.message);
          return;
        }
        for (const row of data ?? []) {
          const loan = row.loans as { loan_number?: string } | null;
          const due = row.due_date as string;
          const completed = row.completed_at;
          const loanId = row.loan_id as string;
          if (!completed) {
            events.push({
              id: `ms-due-${row.id}`,
              kind: "milestone_due",
              title: row.name as string,
              subtitle: loan?.loan_number ? `Loan ${loan.loan_number}` : undefined,
              start: `${toDateOnlyISO(due)}T12:00:00.000Z`,
              allDay: true,
              loanId,
              loanNumber: loan?.loan_number,
              deepLink: `/loans/${loanId}`,
            });
          }
        }
      })(),
    );

    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from("loan_milestones")
          .select("id, loan_id, name, milestone_type, due_date, completed_at, loans(loan_number)")
          .not("completed_at", "is", null)
          .gte("completed_at", fromISO)
          .lte("completed_at", toISO);
        if (error) {
          console.warn("[calendar] milestones completed:", error.message);
          return;
        }
        for (const row of data ?? []) {
          const loan = row.loans as { loan_number?: string } | null;
          const loanId = row.loan_id as string;
          const at = row.completed_at as string;
          events.push({
            id: `ms-done-${row.id}`,
            kind: "milestone_completed",
            title: `${row.name as string} (completed)`,
            subtitle: loan?.loan_number ? `Loan ${loan.loan_number}` : undefined,
            start: at,
            allDay: false,
            loanId,
            loanNumber: loan?.loan_number,
            deepLink: `/loans/${loanId}`,
          });
        }
      })(),
    );
  }

  // ── Locks: rate_locks (preferred) + loans.lock_expiration_date (deduped) ─
  const rateLockKeys = new Set<string>();

  if (sources.locks) {
    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from("rate_locks")
          .select("id, loan_id, lock_expiration, status, loans(loan_number)")
          .in("status", ["active", "extended"])
          .gte("lock_expiration", fromStr)
          .lte("lock_expiration", toStr);
        if (error) {
          console.warn("[calendar] rate_locks:", error.message);
          return;
        }
        for (const row of data ?? []) {
          const loanId = row.loan_id as string;
          const exp = row.lock_expiration as string;
          const loan = row.loans as { loan_number?: string } | null;
          const day = toDateOnlyISO(exp);
          rateLockKeys.add(`${loanId}_${day}`);
          events.push({
            id: `rl-${row.id}`,
            kind: "rate_lock",
            title: `Rate lock expires`,
            subtitle: loan?.loan_number ? `Loan ${loan.loan_number}` : undefined,
            start: `${day}T12:00:00.000Z`,
            allDay: true,
            loanId,
            loanNumber: loan?.loan_number,
            rateLockId: row.id as string,
            deepLink: `/loans/${loanId}`,
          });
        }
      })(),
    );

    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from("loans")
          .select("id, loan_number, lock_expiration_date")
          .not("lock_expiration_date", "is", null)
          .gte("lock_expiration_date", fromStr)
          .lte("lock_expiration_date", toStr);
        if (error) {
          console.warn("[calendar] loans lock:", error.message);
          return;
        }
        for (const row of data ?? []) {
          const loanId = row.id as string;
          const exp = row.lock_expiration_date as string;
          const day = toDateOnlyISO(exp);
          if (rateLockKeys.has(`${loanId}_${day}`)) continue;
          events.push({
            id: `ll-${loanId}-${day}`,
            kind: "loan_lock",
            title: `Lock expiration (loan)`,
            subtitle: `Loan ${row.loan_number as string}`,
            start: `${day}T12:00:00.000Z`,
            allDay: true,
            loanId,
            loanNumber: row.loan_number as string,
            deepLink: `/loans/${loanId}`,
          });
        }
      })(),
    );
  }

  // ── Meetings ────────────────────────────────────────────────────────────
  if (sources.meetings) {
    tasks.push(
      (async () => {
        const { data, error } = await meetingsTable()
          .select(
            "id, title, scheduled_at, duration_minutes, status, meeting_type, loan_id, loans(loan_number)",
          )
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", fromISO)
          .lte("scheduled_at", toISO)
          .neq("status", "cancelled");
        if (error) {
          console.warn("[calendar] meetings:", error.message);
          return;
        }
        for (const row of data ?? []) {
          const id = row.id as string;
          const start = row.scheduled_at as string;
          const dur = row.duration_minutes as number | null;
          const loanId = row.loan_id as string | null;
          const loan = row.loans as { loan_number?: string } | null;
          const mType = (row.meeting_type as string) || "manual";
          const isBorrower = mType === "borrower_appointment";
          let end: string | undefined;
          if (dur && start) {
            try {
              const ms = parseISO(start).getTime() + dur * 60_000;
              end = new Date(ms).toISOString();
            } catch {
              /* ignore */
            }
          }
          events.push({
            id: `mt-${id}`,
            kind: isBorrower ? "borrower_appointment" : "meeting",
            title: row.title as string,
            subtitle: loan?.loan_number ? `Loan ${loan.loan_number}` : undefined,
            start,
            end,
            allDay: false,
            loanId: loanId ?? undefined,
            loanNumber: loan?.loan_number ?? undefined,
            meetingId: id,
            deepLink: `/meetings/${id}`,
          });
        }
      })(),
    );
  }

  // ── Conditions ───────────────────────────────────────────────────────────
  if (sources.conditions) {
    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from("loan_conditions")
          .select("id, loan_id, description, due_date, loans(loan_number)")
          .not("due_date", "is", null)
          .gte("due_date", fromStr)
          .lte("due_date", toStr)
          .in("status", ["pending", "received", "expired"]);
        if (error) {
          console.warn("[calendar] conditions:", error.message);
          return;
        }
        for (const row of data ?? []) {
          const loanId = row.loan_id as string;
          const due = row.due_date as string;
          const loan = row.loans as { loan_number?: string } | null;
          const desc = (row.description as string)?.slice(0, 80) || "Condition due";
          events.push({
            id: `cd-${row.id}`,
            kind: "condition",
            title: desc,
            subtitle: loan?.loan_number ? `Loan ${loan.loan_number}` : undefined,
            start: `${toDateOnlyISO(due)}T12:00:00.000Z`,
            allDay: true,
            loanId,
            loanNumber: loan?.loan_number,
            conditionId: row.id as string,
            deepLink: `/loans/${loanId}`,
          });
        }
      })(),
    );
  }

  // ── Action items ─────────────────────────────────────────────────────────
  if (sources.actionItems) {
    const addActionRows = (rows: Record<string, unknown>[], dateField: "due_date" | "start_date") => {
      for (const row of rows) {
        const id = row.id as string;
        const loanId = row.loan_id as string | null;
        const title = row.title as string;
        const d = row[dateField] as string | null;
        if (!d) continue;
        const day = dateField === "due_date" ? toDateOnlyISO(d) : toDateOnlyISO(d);
        events.push({
          id: `ai-${id}-${dateField}`,
          kind: "action_item",
          title,
          subtitle: loanId ? "Linked loan" : undefined,
          start: `${day}T12:00:00.000Z`,
          allDay: true,
          loanId: loanId ?? undefined,
          actionItemId: id,
          deepLink: loanId ? `/loans/${loanId}` : "/action-items",
        });
      }
    };

    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from("action_items")
          .select("id, title, loan_id, due_date, start_date, status")
          .in("status", ["not_started", "in_progress", "blocked", "on_hold", "pending"])
          .not("due_date", "is", null)
          .gte("due_date", fromStr)
          .lte("due_date", toStr);
        if (error) {
          console.warn("[calendar] action_items due:", error.message);
          return;
        }
        addActionRows((data ?? []) as Record<string, unknown>[], "due_date");
      })(),
    );

    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from("action_items")
          .select("id, title, loan_id, due_date, start_date, status")
          .in("status", ["not_started", "in_progress", "blocked", "on_hold", "pending"])
          .not("start_date", "is", null)
          .gte("start_date", fromStr)
          .lte("start_date", toStr);
        if (error) {
          console.warn("[calendar] action_items start:", error.message);
          return;
        }
        addActionRows((data ?? []) as Record<string, unknown>[], "start_date");
      })(),
    );
  }

  await Promise.all(tasks);

  // Dedupe action items that appeared on both due_date and start_date same id
  const seenAi = new Set<string>();
  const deduped: UnifiedCalendarEvent[] = [];
  for (const e of events) {
    if (e.kind === "action_item" && e.actionItemId) {
      const k = `${e.actionItemId}-${e.start.slice(0, 10)}`;
      if (seenAi.has(k)) continue;
      seenAi.add(k);
    }
    deduped.push(e);
  }

  deduped.sort(sortEvents);

  if (includeOutlook) {
    try {
      const outlook = await getCalendarEvents(rangeStart, rangeEnd);
      for (const o of outlook) {
        deduped.push(outlookToUnified(o));
      }
      deduped.sort(sortEvents);
    } catch (e) {
      console.warn("[calendar] outlook:", e);
    }
  }

  return deduped;
}

export function useUnifiedCalendarEvents(options: UseUnifiedCalendarOptions) {
  const { rangeStart, rangeEnd, sources, includeOutlook, enabled = true } = options;
  const rangeKey = `${format(rangeStart, "yyyy-MM-dd")}_${format(rangeEnd, "yyyy-MM-dd")}`;
  const sourcesKey = (Object.keys(sources) as CalendarSourceKey[])
    .filter((k) => sources[k])
    .sort()
    .join(",");

  return useQuery({
    queryKey: queryKeys.calendar.unified(rangeKey, sourcesKey, includeOutlook),
    queryFn: () => fetchUnifiedCalendarEvents(options),
    enabled,
    staleTime: 60_000,
  });
}
