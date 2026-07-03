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
import { Loader2, RefreshCw, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  nodename: string;
  nodeport: number;
  database: string;
  username: string;
  active: boolean;
}

function useCronJobs() {
  return useQuery({
    queryKey: ["admin", "cron-jobs"],
    queryFn: async (): Promise<CronJob[]> => {
      const { data, error } = await supabase.functions.invoke("admin-cronjobs", {
        body: { action: "list_jobs" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.jobs ?? []) as CronJob[];
    },
  });
}

export default function CronJobs() {
  const { data: jobs, isLoading, refetch, isRefetching, error } = useCronJobs();
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<{
    ok: boolean;
    checkedAt: string;
    listJobsMessage: string;
    listRunsMessage: string;
  } | null>(null);
  const errorMessage =
    error instanceof Error ? error.message : "Failed to load cron jobs.";

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
          <h1 className="text-2xl font-semibold tracking-tight">Cron Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Scheduled jobs managed by pg_cron. These run automatically at the configured schedule.
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
            <Link to="/admin/cronjob-logs">
              <Clock className="mr-2 h-4 w-4" />
              View Logs
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
            <Clock className="h-5 w-5 text-muted-foreground" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription>
            All cron jobs registered in pg_cron. Schedules use standard cron syntax (minute hour day month weekday).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load cron jobs</AlertTitle>
              <AlertDescription>
                {errorMessage}
                {" "}
                Verify `pg_cron` is enabled and that `get_cron_jobs()` exists in the database.
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !jobs || jobs.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                No cron jobs found. If you expect jobs here, make sure a cron schedule has been created in `cron.job`.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Database</TableHead>
                  <TableHead>Command</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.jobid}>
                    <TableCell className="font-mono text-xs">{job.jobid}</TableCell>
                    <TableCell className="font-medium">{job.jobname || "—"}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {job.schedule}
                      </code>
                    </TableCell>
                    <TableCell>
                      {job.active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{job.database}</TableCell>
                    <TableCell>
                      <code className="block max-w-md truncate rounded bg-muted px-1.5 py-0.5 text-xs font-mono" title={job.command}>
                        {job.command.length > 120 ? job.command.slice(0, 120) + "…" : job.command}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
