// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
/**
 * Meeting Analytics — metrics from the `meetings` and `action_items` tables.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Calendar,
  Clock,
  Video,
  CheckSquare,
  RefreshCw,
  Sparkles,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

function hasAiSummaryMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  return Boolean(
    m.ai_summary ?? m.summary ?? m.meeting_summary ?? m.ai_summary_text,
  );
}

async function fetchMeetingAnalytics(days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const iso = cutoff.toISOString();

  const [{ data: meetings, error: meetingsError }, { count: actionCount, error: actionError }] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("id, duration_minutes, status, meeting_type, metadata, scheduled_at")
        .gte("scheduled_at", iso),
      supabase
        .from("action_items")
        .select("*", { count: "exact", head: true })
        .gte("created_at", iso),
    ]);

  if (meetingsError) throw meetingsError;
  if (actionError) throw actionError;

  const rows = meetings ?? [];
  const total = rows.length;
  const durations = rows
    .map((r) => r.duration_minutes)
    .filter((d): d is number => d != null && d > 0);
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const aiSummaries = rows.filter((r) => hasAiSummaryMetadata(r.metadata)).length;

  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    const s = r.status || "unknown";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const byType = rows.reduce<Record<string, number>>((acc, r) => {
    const t = r.meeting_type || "unknown";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total,
    avgDuration,
    aiSummaries,
    actionCount: actionCount ?? 0,
    byStatus,
    byType,
  };
}

export default function MeetingAnalytics() {
  const [timeRange, setTimeRange] = useState("30");

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-meeting-analytics", timeRange],
    queryFn: () => fetchMeetingAnalytics(parseInt(timeRange, 10)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meeting Analytics</h1>
          <p className="text-muted-foreground">
            Metrics for meetings with <code className="text-xs">scheduled_at</code> in the selected window
          </p>
        </div>
        <div className="flex gap-2">
          <SearchableSelect
            value={timeRange}
            onChange={setTimeRange}
            className="w-40"
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
              { value: "365", label: "Last year" },
            ]}
          />
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load analytics"}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "—" : data?.total ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "—" : `${data?.avgDuration ?? 0} min`}
            </div>
            <p className="text-xs text-muted-foreground">From duration_minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Summaries</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "—" : data?.aiSummaries ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Meetings with summary metadata</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Action Items</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "—" : data?.actionCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Created in period (all sources)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Meetings by Status
            </CardTitle>
            <CardDescription>Count per meeting status</CardDescription>
          </CardHeader>
          <CardContent>
            {!data || Object.keys(data.byStatus).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No meetings in this range.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {Object.entries(data.byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, n]) => (
                    <li key={status} className="flex justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
                      <span className="capitalize">{status}</span>
                      <span className="font-medium">{n}</span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Meetings by Type
            </CardTitle>
            <CardDescription>Count per meeting_type</CardDescription>
          </CardHeader>
          <CardContent>
            {!data || Object.keys(data.byType).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No meetings in this range.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {Object.entries(data.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, n]) => (
                    <li key={type} className="flex justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
                      <span className="capitalize">{type}</span>
                      <span className="font-medium">{n}</span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
