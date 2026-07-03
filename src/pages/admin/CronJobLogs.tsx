import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  RefreshCw,
  ScrollText,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

interface CronRun {
  runid: number;
  jobid: number;
  job_pid: number;
  database: string;
  username: string;
  command: string;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string;
  jobname: string | null;
}

function useCronJobLogs(limit: number) {
  return useQuery({
    queryKey: ["admin", "cron-job-logs", limit],
    queryFn: async (): Promise<CronRun[]> => {
      const { data, error } = await supabase.functions.invoke("admin-cronjobs", {
        body: { action: "list_runs", limit },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.runs ?? []) as CronRun[];
    },
  });
}

function statusBadge(status: string) {
  switch (status) {
    case "succeeded":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100">Succeeded</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "running":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-100">Running</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDuration(start: string, end: string): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(ts: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogRow({ run }: { run: CronRun }) {
  const [open, setOpen] = useState(false);
  const hasDetail = run.return_message || run.command;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <>
        <TableRow className={run.status === "failed" ? "bg-red-50/30 dark:bg-red-950/10" : undefined}>
          <TableCell className="font-mono text-xs">{run.runid}</TableCell>
          <TableCell className="font-medium">{run.jobname || `Job #${run.jobid}`}</TableCell>
          <TableCell>{statusBadge(run.status)}</TableCell>
          <TableCell className="text-xs">{formatTimestamp(run.start_time)}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{formatDuration(run.start_time, run.end_time)}</TableCell>
          <TableCell className="text-right">
            {hasDetail && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            )}
          </TableCell>
        </TableRow>
        {hasDetail && (
          <CollapsibleContent asChild>
            <TableRow className="bg-muted/20">
              <TableCell colSpan={6} className="py-3 px-6">
                <div className="space-y-2 max-w-3xl">
                  {run.return_message && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Return Message</p>
                      <pre className="rounded-md border bg-muted/30 p-2.5 text-xs whitespace-pre-wrap break-all font-mono">
                        {run.return_message}
                      </pre>
                    </div>
                  )}
                  {run.command && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Command</p>
                      <pre className="rounded-md border bg-muted/30 p-2.5 text-xs whitespace-pre-wrap break-all font-mono">
                        {run.command}
                      </pre>
                    </div>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>PID: {run.job_pid}</span>
                    <span>DB: {run.database}</span>
                    <span>User: {run.username}</span>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </CollapsibleContent>
        )}
      </>
    </Collapsible>
  );
}

export default function CronJobLogs() {
  const [limit, setLimit] = useState(50);
  const { data: runs, isLoading, refetch, isRefetching, error } = useCronJobLogs(limit);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<{
    ok: boolean;
    checkedAt: string;
    listJobsMessage: string;
    listRunsMessage: string;
  } | null>(null);
  const errorMessage =
    error instanceof Error ? error.message : "Failed to load cron job logs.";

  const runHealthCheck = async () => {
    setHealthChecking(true);
    setHealthResult(null);
    try {
      const [jobsResp, runsResp] = await Promise.all([
        supabase.functions.invoke("admin-cronjobs", {
          body: { action: "list_jobs" },
        }),
        supabase.functions.invoke("admin-cronjobs", {
          body: { action: "list_runs", limit: 1 },
        }),
      ]);

      const jobsInvokeError = jobsResp.error;
      const runsInvokeError = runsResp.error;
      const jobsDataError =
        jobsResp.data?.error && typeof jobsResp.data.error === "string"
          ? jobsResp.data.error
          : null;
      const runsDataError =
        runsResp.data?.error && typeof runsResp.data.error === "string"
          ? runsResp.data.error
          : null;

      const jobsOk = !jobsInvokeError && !jobsDataError;
      const runsOk = !runsInvokeError && !runsDataError;

      setHealthResult({
        ok: jobsOk && runsOk,
        checkedAt: new Date().toISOString(),
        listJobsMessage: jobsOk
          ? "list_jobs: ok"
          : `list_jobs: ${jobsDataError ?? jobsInvokeError?.message ?? "failed"}`,
        listRunsMessage: runsOk
          ? "list_runs: ok"
          : `list_runs: ${runsDataError ?? runsInvokeError?.message ?? "failed"}`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      setHealthResult({
        ok: false,
        checkedAt: new Date().toISOString(),
        listJobsMessage: `list_jobs: ${message}`,
        listRunsMessage: "list_runs: skipped",
      });
    } finally {
      setHealthChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cron Job Logs</h1>
          <p className="text-sm text-muted-foreground">
            Execution history of all pg_cron scheduled jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runHealthCheck}
            disabled={healthChecking}
          >
            {healthChecking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Run Health Check
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/cronjobs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Jobs
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {healthResult && (
        <Alert variant={healthResult.ok ? "default" : "destructive"}>
          {healthResult.ok ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {healthResult.ok ? "Cron health check passed" : "Cron health check failed"}
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-1">
              <p>{healthResult.listJobsMessage}</p>
              <p>{healthResult.listRunsMessage}</p>
              <p className="text-xs text-muted-foreground">
                Checked: {new Date(healthResult.checkedAt).toLocaleString()}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            Run History
          </CardTitle>
          <CardDescription>
            Showing the last {limit} cron job executions, newest first. Expand a row to see the command and return message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load cron job logs</AlertTitle>
              <AlertDescription>
                {errorMessage}
                {" "}
                Verify `pg_cron` is enabled and that `get_cron_job_run_details()` exists in the database.
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !runs || runs.length === 0 ? (
            <div className="text-center py-8">
              <ScrollText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                No cron job runs found. Jobs will appear here once pg_cron executes them.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Run ID</TableHead>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <LogRow key={run.runid} run={run} />
                  ))}
                </TableBody>
              </Table>
              {runs.length >= limit && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLimit((prev) => prev + 50)}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
