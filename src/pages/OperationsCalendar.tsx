import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addMonths,
  subMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";
import {
  useUnifiedCalendarEvents,
  DEFAULT_CALENDAR_SOURCES,
  type CalendarSourceKey,
  type UnifiedCalendarEvent,
} from "@/hooks/useUnifiedCalendarEvents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { ChevronLeft, ChevronRight, Loader2, ExternalLink, Settings, ArrowLeft } from "lucide-react";

const SOURCES_STORAGE = "mct-calendar-sources";
const OUTLOOK_STORAGE = "mct-calendar-outlook";
const VIEW_STORAGE = "mct-calendar-view";

type CalView = "month" | "week" | "agenda";

const SOURCE_LABELS: Record<Exclude<CalendarSourceKey, "outlook">, string> = {
  milestones: "Milestones",
  locks: "Rate locks",
  meetings: "Meetings",
  conditions: "Conditions",
  actionItems: "Action items",
};

function loadSources(): Record<CalendarSourceKey, boolean> {
  try {
    const raw = localStorage.getItem(SOURCES_STORAGE);
    if (!raw) return { ...DEFAULT_CALENDAR_SOURCES };
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { ...DEFAULT_CALENDAR_SOURCES, ...parsed };
  } catch {
    return { ...DEFAULT_CALENDAR_SOURCES };
  }
}

function eventKindLabel(kind: UnifiedCalendarEvent["kind"]): string {
  switch (kind) {
    case "milestone_due":
      return "Milestone due";
    case "milestone_completed":
      return "Milestone done";
    case "loan_lock":
      return "Lock (loan)";
    case "rate_lock":
      return "Rate lock";
    case "meeting":
      return "Meeting";
    case "borrower_appointment":
      return "Borrower appt";
    case "condition":
      return "Condition";
    case "action_item":
      return "Action item";
    case "outlook":
      return "Outlook";
    default:
      return kind;
  }
}

function kindDotClass(kind: UnifiedCalendarEvent["kind"]): string {
  switch (kind) {
    case "milestone_due":
    case "milestone_completed":
      return "bg-blue-500";
    case "loan_lock":
    case "rate_lock":
      return "bg-amber-500";
    case "meeting":
      return "bg-violet-500";
    case "borrower_appointment":
      return "bg-fuchsia-500";
    case "condition":
      return "bg-teal-500";
    case "action_item":
      return "bg-slate-400";
    case "outlook":
      return "bg-neutral-500";
    default:
      return "bg-muted-foreground";
  }
}

function eventOnDay(ev: UnifiedCalendarEvent, day: Date): boolean {
  const d = new Date(ev.start);
  if (Number.isNaN(d.getTime())) return false;
  if (ev.allDay) {
    return isSameDay(d, day);
  }
  return isSameDay(d, day);
}

function EventRow({ ev }: { ev: UnifiedCalendarEvent }) {
  const internal = ev.deepLink.startsWith("/") && ev.deepLink.length > 1;
  const outlook = ev.kind === "outlook" && /^https?:\/\//i.test(ev.deepLink);
  const time = ev.allDay ? "All day" : format(new Date(ev.start), "p");

  const body = (
    <>
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", kindDotClass(ev.kind))} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{ev.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{time}</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">
            {eventKindLabel(ev.kind)}
          </Badge>
          {ev.subtitle && <span className="truncate">{ev.subtitle}</span>}
        </div>
      </div>
      {outlook && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </>
  );

  const className =
    "flex gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-muted/60";

  if (outlook) {
    return (
      <a
        href={ev.deepLink}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {body}
      </a>
    );
  }

  if (internal) {
    return (
      <Link to={ev.deepLink} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <div className={cn(className, "cursor-default")}>
      {body}
    </div>
  );
}

export default function OperationsCalendar() {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useFeatureFlags();
  const meetingsModuleOn = isFeatureEnabled("enableMeetings");

  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalView>(() => {
    try {
      const v = localStorage.getItem(VIEW_STORAGE) as CalView | null;
      if (v === "month" || v === "week" || v === "agenda") return v;
    } catch {
      /* ignore */
    }
    return "month";
  });
  const [sources, setSources] = useState<Record<CalendarSourceKey, boolean>>(loadSources);
  const [includeOutlook, setIncludeOutlook] = useState(() => {
    try {
      return localStorage.getItem(OUTLOOK_STORAGE) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem(SOURCES_STORAGE, JSON.stringify(sources));
  }, [sources]);

  useEffect(() => {
    localStorage.setItem(OUTLOOK_STORAGE, includeOutlook ? "1" : "0");
  }, [includeOutlook]);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE, view);
  }, [view]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const sm = startOfMonth(cursor);
      const em = endOfMonth(cursor);
      return {
        rangeStart: startOfWeek(sm, { weekStartsOn: 0 }),
        rangeEnd: endOfWeek(em, { weekStartsOn: 0 }),
      };
    }
    if (view === "week") {
      const ws = startOfWeek(cursor, { weekStartsOn: 0 });
      const we = endOfWeek(cursor, { weekStartsOn: 0 });
      return { rangeStart: ws, rangeEnd: we };
    }
    const sm = startOfMonth(cursor);
    const em = endOfMonth(cursor);
    return { rangeStart: sm, rangeEnd: em };
  }, [cursor, view]);

  const querySources = useMemo(() => {
    return {
      ...sources,
      outlook: includeOutlook,
      meetings: sources.meetings && meetingsModuleOn,
    };
  }, [sources, includeOutlook, meetingsModuleOn]);

  const { data: events = [], isLoading, isFetching, error, refetch } = useUnifiedCalendarEvents({
    rangeStart,
    rangeEnd,
    sources: querySources,
    includeOutlook,
  });

  const visibleEvents = useMemo(() => {
    return events.filter((ev) => {
      switch (ev.kind) {
        case "milestone_due":
        case "milestone_completed":
          return sources.milestones;
        case "loan_lock":
        case "rate_lock":
          return sources.locks;
        case "meeting":
        case "borrower_appointment":
          return sources.meetings && meetingsModuleOn;
        case "condition":
          return sources.conditions;
        case "action_item":
          return sources.actionItems;
        case "outlook":
          return includeOutlook;
        default:
          return true;
      }
    });
  }, [events, sources, includeOutlook, meetingsModuleOn]);

  const toggleSource = useCallback((key: CalendarSourceKey) => {
    setSources((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const monthDays = useMemo(() => {
    const sm = startOfMonth(cursor);
    const em = endOfMonth(cursor);
    const start = startOfWeek(sm, { weekStartsOn: 0 });
    const end = endOfWeek(em, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(cursor, { weekStartsOn: 0 });
    const we = endOfWeek(cursor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: ws, end: we });
  }, [cursor]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Operations calendar</h1>
            <p className="text-muted-foreground">
              Milestones, locks, meetings, conditions, and tasks in one view (loan officer, branch manager, admin).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-background p-0.5">
            {(["month", "week", "agenda"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                className="capitalize"
                onClick={() => setView(v)}
              >
                {v}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sources &amp; Outlook</CardTitle>
          <CardDescription>
            Toggle what appears on the calendar. Outlook requires a connected Microsoft account in Settings.
            Google Calendar is not wired yet (see integration docs when product prioritizes it).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          {(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <Switch
                id={`src-${key}`}
                checked={sources[key]}
                disabled={key === "meetings" && !meetingsModuleOn}
                onCheckedChange={() => toggleSource(key)}
              />
              <Label htmlFor={`src-${key}`} className="text-sm font-normal cursor-pointer">
                {SOURCE_LABELS[key]}
                {key === "meetings" && !meetingsModuleOn ? " (module off)" : ""}
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2 border-l pl-4">
            <Switch
              id="src-outlook"
              checked={includeOutlook}
              onCheckedChange={(v) => {
                setIncludeOutlook(v);
                setSources((s) => ({ ...s, outlook: v }));
              }}
            />
            <Label htmlFor="src-outlook" className="text-sm font-normal cursor-pointer">
              Microsoft Outlook overlay
            </Label>
          </div>
          <Button variant="outline" size="sm" asChild className="lg:ml-auto">
            <Link to="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              if (view === "month") setCursor((d) => subMonths(d, 1));
              else if (view === "week") setCursor((d) => subWeeks(d, 1));
              else setCursor((d) => subMonths(d, 1));
            }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              if (view === "month") setCursor((d) => addMonths(d, 1));
              else if (view === "week") setCursor((d) => addWeeks(d, 1));
              else setCursor((d) => addMonths(d, 1));
            }}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <span className="text-lg font-semibold">
            {view === "week"
              ? `Week of ${format(startOfWeek(cursor, { weekStartsOn: 0 }), "MMM d, yyyy")}`
              : format(cursor, "MMMM yyyy")}
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load calendar data."}
        </p>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : view === "agenda" ? (
        <Card>
          <CardHeader>
            <CardTitle>Agenda</CardTitle>
            <CardDescription>Events in the visible range, soonest first</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {visibleEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events in this range.</p>
            ) : (
              visibleEvents.map((ev) => <EventRow key={ev.id} ev={ev} />)
            )}
          </CardContent>
        </Card>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {weekDays.map((day) => (
            <Card key={day.toISOString()} className="min-h-[140px]">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {format(day, "EEE d")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {visibleEvents
                  .filter((ev) => eventOnDay(ev, day))
                  .map((ev) => (
                    <EventRow key={`${ev.id}-${day.toISOString()}`} ev={ev} />
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-1 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const inMonth = isSameMonth(day, cursor);
              const dayEvents = visibleEvents.filter((ev) => eventOnDay(ev, day));
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[100px] border-b border-r p-1 text-left align-top sm:min-h-[120px]",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                  )}
                >
                  <div className="text-xs font-semibold">{format(day, "d")}</div>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 4).map((ev) => {
                      const isOut = ev.kind === "outlook" && /^https?:\/\//i.test(ev.deepLink);
                      return (
                        <div
                          key={ev.id}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[10px] text-white sm:text-xs",
                            kindDotClass(ev.kind),
                          )}
                          title={ev.title}
                        >
                          {isOut ? (
                            <a
                              href={ev.deepLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-white hover:underline"
                            >
                              {ev.title}
                            </a>
                          ) : (
                            <Link to={ev.deepLink} className="block truncate text-white hover:underline">
                              {ev.title}
                            </Link>
                          )}
                        </div>
                      );
                    })}
                    {dayEvents.length > 4 && (
                      <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 4} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(
            [
              "milestone_due",
              "rate_lock",
              "meeting",
              "borrower_appointment",
              "condition",
              "action_item",
              "outlook",
            ] as const
          ).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", kindDotClass(k))} />
              {eventKindLabel(k)}
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
