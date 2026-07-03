// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useState } from "react";
import { useManagementScope } from "@/hooks/useManagementScope";
import { useManagerDashboard, type LoanDetailRow } from "@/hooks/useManagerDashboard";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useAgentEnabled, PORTFOLIO_SUMMARY_AGENT_SLUG, PIPELINE_PRIORITIZATION_AGENT_SLUG, RATE_ALERT_INTELLIGENCE_AGENT_SLUG, BRANCH_PERFORMANCE_COACH_AGENT_SLUG, MANAGER_INSIGHT_AGENT_SLUG } from "@/hooks/useAgentEnabled";
import { useGeneratePipelineSummary } from "@/hooks/usePipelineSummary";
import { fetchPipelineLoansWithRisk } from "@/lib/loan-export-queries";
import { useHideDemoData } from "@/hooks/useHideDemoData";
import {
  exportLoanPipelineToCSV,
  exportLoanPipelineToExcel,
  exportManagerDashboardSummaryToCSV,
  pipelineExportFilename,
} from "@/lib/loan-export-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Loader2, Activity, AlertTriangle, Gauge, Timer, Download, Sparkles, Zap, TrendingUp, ShieldAlert, TrendingDown, ArrowLeft, Clock } from "lucide-react";
import { useUnreadLockAlertCount } from "@/hooks/useLockAlerts";
import { useTopPriorityLoans } from "@/hooks/usePipelinePriority";
import { useRateAlertAnalyses } from "@/hooks/useRateAlertIntelligence";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import { BranchCoachingDigestCard } from "@/components/dashboard/BranchCoachingDigestCard";
import { LeaderboardWidget } from "@/components/leaderboard/LeaderboardWidget";
import {
  RiskDistributionDonut,
  PipelineFunnelChart,
  OfficerWorkloadChart,
  ActionHitlist,
} from "@/components/dashboard/ManagerCharts";
import { useAskManagerInsight, useRunInactivityReminders } from "@/hooks/useManagerControlTower";
import { Textarea } from "@/components/ui/textarea";

function normalizeRoleSlug(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function dashboardGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ScopeBadge() {
  const { scope } = useManagementScope();

  let label = "No scope";
  if (scope === "org") label = "Organization-wide";
  if (scope === "branch") label = "Branch";
  if (scope === "personal") label = "My pipeline";

  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  );
}

const portfolioSummaryMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="scroll-m-20 text-lg font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-4 text-sm font-semibold text-foreground first:mt-0">{children}</h4>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm leading-relaxed text-foreground/90 [&:not(:first-child)]:mt-3" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed marker:text-muted-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed marker:text-muted-foreground" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-0.5 [&>p]:my-0" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-foreground/90" {...props}>
      {children}
    </em>
  ),
  hr: (props) => <hr className="my-4 border-border" {...props} />,
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-3 border-l-2 border-primary/35 bg-muted/40 py-2 pl-4 pr-2 text-sm text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, ...props }) => (
    <a className="font-medium text-primary underline underline-offset-4 hover:text-primary/80" {...props}>
      {children}
    </a>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/80 p-4 font-mono text-xs leading-relaxed text-foreground"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[240px] border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/60 [&_tr]:border-b" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="px-3 py-2 text-left font-medium text-foreground" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-t border-border px-3 py-2 align-top text-foreground/90" {...props}>
      {children}
    </td>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /\blanguage-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={cn("block bg-transparent p-0 font-mono text-xs text-foreground", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground" {...props}>
        {children}
      </code>
    );
  },
};

function PortfolioSummaryMarkdown({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) {
    return <p className="text-sm text-muted-foreground">No summary text was returned.</p>;
  }
  return (
    <div className="text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={portfolioSummaryMarkdownComponents}>
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}

type MetricDrilldown = "active" | "atRisk" | "lockExpiring" | "onTime" | null;

function riskBadgeClass(level: string) {
  switch (level) {
    case "critical": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "medium": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    default: return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  }
}

function LoanDrilldownTable({ loans }: { loans: LoanDetailRow[] }) {
  if (loans.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No loans match this filter.</p>;
  }
  return (
    <div className="overflow-x-auto text-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-2 py-2">Loan #</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Officer</th>
            <th className="px-2 py-2">Risk</th>
            <th className="px-2 py-2">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.loanId} className="border-b last:border-0">
              <td className="px-2 py-2">
                <Link className="font-medium text-primary hover:underline" to={`/loans/${loan.loanId}`}>
                  {loan.loanNumber}
                </Link>
              </td>
              <td className="px-2 py-2 text-xs capitalize">{loan.loanStatus}</td>
              <td className="px-2 py-2 text-xs">{loan.loanOfficerName}</td>
              <td className="px-2 py-2">
                <Badge className={cn("text-[10px] capitalize", riskBadgeClass(loan.riskLevel))}>
                  {loan.riskLevel}
                </Badge>
              </td>
              <td className="px-2 py-2 text-xs text-muted-foreground">
                {new Date(loan.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { scope } = useManagementScope();
  const { data, isLoading, isError } = useManagerDashboard();
  const { data: unreadLockAlerts } = useUnreadLockAlertCount();
  const { hasPermission } = useEffectivePermissions();
  const canExport =
    hasPermission("loans:read") ||
    hasPermission("loans:export");
  const [exportBusy, setExportBusy] = useState<null | "loansCsv" | "loansXls" | "summary">(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const portfolioAgent = useAgentEnabled(PORTFOLIO_SUMMARY_AGENT_SLUG);
  const priorityAgent = useAgentEnabled(PIPELINE_PRIORITIZATION_AGENT_SLUG);
  const rateAlertAgent = useAgentEnabled(RATE_ALERT_INTELLIGENCE_AGENT_SLUG);
  const coachAgent = useAgentEnabled(BRANCH_PERFORMANCE_COACH_AGENT_SLUG);
  const managerInsightAgent = useAgentEnabled(MANAGER_INSIGHT_AGENT_SLUG);
  const { profile } = useAuth();
  const profileWithMeta = profile as (typeof profile & { customRoleName?: string | null; branch_id?: string | null }) | null;
  const showCoachingDigest = coachAgent.isEnabled && isAgentAllowedForUser("branch-performance-coach-agent", profile);
  const profileCustomRoleSlug = normalizeRoleSlug(profileWithMeta?.customRoleName ?? null);
  const roleSlug = normalizeRoleSlug(profile?.role ?? profileWithMeta?.customRoleName ?? null);
  const isBranchManager = scope === "branch" || profileCustomRoleSlug === "branch_manager";
  const isMlo =
    roleSlug === "loan_officer" ||
    roleSlug === "mlo" ||
    roleSlug === "mortgage_loan_officer";
  const audienceLabel = isBranchManager
    ? "branch manager"
    : isMlo
      ? "MLO"
      : "manager";
  const coachBranchId = isBranchManager ? (profileWithMeta?.branch_id ?? null) : null;
  const { data: topPriorityLoans } = useTopPriorityLoans(10);
  const { data: rateAlerts } = useRateAlertAnalyses();
  const generateSummary = useGeneratePipelineSummary();
  const runReminders = useRunInactivityReminders();
  const askInsight = useAskManagerInsight();
  const [insightQuestion, setInsightQuestion] = useState("");
  const [insightAnswer, setInsightAnswer] = useState("");
  const [drilldown, setDrilldown] = useState<MetricDrilldown>(null);
  const hideDemo = useHideDemoData();

  async function exportFullLoans(format: "csv" | "xls") {
    if (!canExport) return;
    setExportBusy(format === "csv" ? "loansCsv" : "loansXls");
    try {
      const rows = await fetchPipelineLoansWithRisk({ hideDemo });
      if (rows.length === 0) {
        toast.message("No loans in your scope to export.");
        return;
      }
      const base = pipelineExportFilename("pipeline-manager");
      if (format === "csv") exportLoanPipelineToCSV(rows, base);
      else exportLoanPipelineToExcel(rows, base);
      toast.success(`Exported ${rows.length} loan(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportBusy(null);
    }
  }

  function exportSummaryCsv() {
    if (!data || !canExport) return;
    setExportBusy("summary");
    try {
      const base = pipelineExportFilename("pipeline-summary");
      exportManagerDashboardSummaryToCSV(
        {
          metrics: data.metrics,
          pipeline: data.pipeline,
          bottlenecks: data.bottlenecks,
          generatedAt: new Date().toISOString(),
          locksExpiring: data.locksExpiring.map((r) => ({
            loanNumber: r.loanNumber,
            lockExpiration: r.lockExpiration,
            loanStatus: r.loanStatus,
            investorStatus: r.investorStatus,
          })),
        },
        base,
      );
      toast.success("Summary CSV downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportBusy(null);
    }
  }

  async function runAiSummary() {
    if (!data) return;
    try {
      const text = await generateSummary.mutateAsync(data);
      setSummaryText(text);
      setSummaryOpen(true);
      toast.success("Summary generated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Summary failed");
    }
  }

  async function runReminderSweep() {
    try {
      const res = await runReminders.mutateAsync();
      const created = Number(res?.summary?.created_action_items ?? 0);
      const notifications = Number(res?.summary?.created_notifications ?? 0);
      toast.success(`Reminder sweep complete: ${created} action item(s), ${notifications} notification(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reminder sweep failed");
    }
  }

  async function askManagerInsight() {
    if (!data || !insightQuestion.trim()) return;
    try {
      const answer = await askInsight.mutateAsync({
        question: insightQuestion.trim(),
        snapshot: data,
      });
      setInsightAnswer(answer);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Insight request failed");
    }
  }

  if (scope === "none") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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
              <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
              <p className="text-sm text-muted-foreground">
                Manager-level pipeline views are not configured for your role yet.
              </p>
            </div>
          </div>
        </div>
        <Alert>
          <AlertDescription>
            Your current role does not have manager visibility configured. An administrator can extend Row Level
            Security and permissions for your role to enable this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {dashboardGreeting()}, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s your {audienceLabel} pipeline snapshot for today.
        </p>
      </div>

      <div className="flex justify-end">
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ScopeBadge />
          {canExport && !isLoading && data && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportBusy !== null}
                onClick={() => exportFullLoans("csv")}
              >
                {exportBusy === "loansCsv" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export loans CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportBusy !== null}
                onClick={() => exportFullLoans("xls")}
              >
                {exportBusy === "loansXls" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export loans Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportBusy !== null}
                onClick={exportSummaryCsv}
              >
                {exportBusy === "summary" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export summary CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={runReminders.isPending}
                onClick={runReminderSweep}
              >
                {runReminders.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="mr-2 h-4 w-4" />
                )}
                Run inactivity reminders
              </Button>
              {portfolioAgent.isEnabled && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={generateSummary.isPending}
                  onClick={runAiSummary}
                >
                  {generateSummary.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  AI summary
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <div className="border-b border-border bg-muted/30 px-6 pb-4 pt-6 pr-14">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
                  aria-hidden
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="text-left text-xl font-semibold leading-tight">
                    Portfolio summary
                  </DialogTitle>
                  <DialogDescription className="text-left text-sm leading-snug">
                    Plain-language overview of your current pipeline metrics. Bold text, lists, and headings are
                    formatted for easy reading.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          <ScrollArea className="h-[min(65vh,520px)] pr-3">
            <div className="px-6 py-5">
              <PortfolioSummaryMarkdown text={summaryText} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {typeof unreadLockAlerts === "number" && unreadLockAlerts > 0 && (
        <Alert>
          <AlertDescription>
            You have <strong>{unreadLockAlerts}</strong> lock alerts (expiring soon or expired). Review them in the
            Pricing &amp; Rate Lock module.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError || !data ? (
        <Alert>
          <AlertDescription>Unable to load manager dashboard data. Please try again shortly.</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Top metrics — clickable drill-down */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card
              className="cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary/20"
              onClick={() => setDrilldown("active")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4 text-primary" />
                  Active Loans
                </CardTitle>
                <CardDescription>Loans in-flight in your scope</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.metrics.activeLoans}</div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-destructive/20"
              onClick={() => setDrilldown("atRisk")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Loans at Risk
                </CardTitle>
                <CardDescription>High or critical risk scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.metrics.atRiskLoans}</div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-amber-500/20"
              onClick={() => setDrilldown("lockExpiring")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Timer className="h-4 w-4 text-amber-500" />
                  Lock Expiring (7d)
                </CardTitle>
                <CardDescription>Loans with locks expiring soon</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.metrics.lockExpiringSoon}</div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-emerald-500/20"
              onClick={() => setDrilldown("onTime")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Gauge className="h-4 w-4 text-emerald-500" />
                  On-time Rate
                </CardTitle>
                <CardDescription>Share of active loans not at risk</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.metrics.onTimeRate}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Drill-down dialog for metric cards */}
          <Dialog open={drilldown !== null} onOpenChange={(open) => { if (!open) setDrilldown(null); }}>
            <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
              <div className="border-b border-border bg-muted/30 px-6 pb-4 pt-6 pr-14">
                <DialogHeader className="text-left">
                  <DialogTitle>
                    {drilldown === "active" && `Active Loans (${data.metrics.activeLoans})`}
                    {drilldown === "atRisk" && `Loans at Risk (${data.metrics.atRiskLoans})`}
                    {drilldown === "lockExpiring" && `Locks Expiring in 7 Days (${data.metrics.lockExpiringSoon})`}
                    {drilldown === "onTime" && `On-time Loans (${data.metrics.activeLoans - data.metrics.atRiskLoans})`}
                  </DialogTitle>
                  <DialogDescription>
                    {drilldown === "active" && "All non-closed loans currently in your pipeline."}
                    {drilldown === "atRisk" && "Loans scored as high or critical risk."}
                    {drilldown === "lockExpiring" && "Loans with rate locks expiring within 7 days."}
                    {drilldown === "onTime" && "Active loans that are not flagged as at-risk."}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <ScrollArea className="h-[min(60vh,500px)]">
                <div className="px-6 py-4">
                  {drilldown === "lockExpiring" ? (
                    data.locksExpiring.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No locks expiring in the next 7 days.</p>
                    ) : (
                      <div className="overflow-x-auto text-sm">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                              <th className="px-2 py-2">Loan #</th>
                              <th className="px-2 py-2">Lock Expiration</th>
                              <th className="px-2 py-2">Status</th>
                              <th className="px-2 py-2">Investor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.locksExpiring.map((row) => (
                              <tr key={row.loanId} className="border-b last:border-0">
                                <td className="px-2 py-2">
                                  <Link className="font-medium text-primary hover:underline" to={`/loans/${row.loanId}`} onClick={() => setDrilldown(null)}>
                                    {row.loanNumber}
                                  </Link>
                                </td>
                                <td className="px-2 py-2 text-xs">{row.lockExpiration || "—"}</td>
                                <td className="px-2 py-2 text-xs capitalize">{row.loanStatus}</td>
                                <td className="px-2 py-2 text-xs capitalize">{row.investorStatus ? row.investorStatus.replace("_", " ") : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    <LoanDrilldownTable
                      loans={
                        drilldown === "active" ? data.activeLoansDetail :
                        drilldown === "atRisk" ? data.atRiskLoansDetail :
                        drilldown === "onTime" ? data.onTimeLoansDetail :
                        []
                      }
                    />
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Action Hitlist — top items to act on first */}
          <ActionHitlist data={data} />

          {/* Visual Charts — pipeline funnel + risk donut + officer workload */}
          <div className="grid gap-4 lg:grid-cols-3">
            <PipelineFunnelChart pipeline={data.pipeline} />
            <RiskDistributionDonut riskByOfficer={data.riskByOfficer} />
          </div>

          <OfficerWorkloadChart riskByOfficer={data.riskByOfficer} />

          {/* Locks expiring (7d) — loans + active rate_locks, investor workflow status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="h-4 w-4 text-amber-500" />
                Locks expiring in 7 days
              </CardTitle>
              <CardDescription>
                Dates from loan file or rate lock; investor column from manual delivery tracking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!data.locksExpiring.length ? (
                <p className="text-sm text-muted-foreground">No matching loans in your scope.</p>
              ) : (
                <div className="overflow-x-auto text-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-2 py-2">Loan</th>
                        <th className="px-2 py-2">Lock expiration</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Investor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.locksExpiring.map((row) => (
                        <tr key={row.loanId} className="border-b last:border-0">
                          <td className="px-2 py-2">
                            <Link
                              className="font-medium text-primary hover:underline"
                              to={`/loans/${row.loanId}`}
                            >
                              {row.loanNumber}
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-xs">{row.lockExpiration || "—"}</td>
                          <td className="px-2 py-2 text-xs capitalize">{row.loanStatus}</td>
                          <td className="px-2 py-2 text-xs capitalize">
                            {row.investorStatus ? row.investorStatus.replace("_", " ") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Priority Loans */}
          {priorityAgent.isEnabled && topPriorityLoans && topPriorityLoans.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Top Priority Loans
                </CardTitle>
                <CardDescription>
                  Loans ranked by urgency — SLA risk, lock expiry, engagement, and close probability.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topPriorityLoans.map((item, idx) => {
                    const loan = item.loans;
                    const borrower = loan?.borrowers;
                    const borrowerName = borrower
                      ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "—"
                      : "—";
                    const score = item.urgency_score;
                    return (
                      <TooltipProvider key={item.id}>
                        <div className="flex items-center gap-3 rounded-md border p-2.5 hover:bg-accent/50 transition-colors">
                          <span className="text-xs font-semibold text-muted-foreground w-5 text-right">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/loans/${item.loan_id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {loan?.loan_number ?? item.loan_id.slice(0, 8)}
                            </Link>
                            <span className="text-xs text-muted-foreground ml-2">{borrowerName}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                            {loan?.status ?? "—"}
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                <Badge
                                  className={`tabular-nums font-semibold text-xs shrink-0 ${
                                    score >= 70
                                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-100"
                                      : score >= 40
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100"
                                        : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100"
                                  }`}
                                >
                                  {score}
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="text-xs">{item.urgency_reason || "No details"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rate Alerts */}
          {rateAlertAgent.isEnabled && rateAlerts && rateAlerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  Rate Alerts
                </CardTitle>
                <CardDescription>
                  Active rate lock alerts — at-risk locks and float-down opportunities across your scope.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rateAlerts.slice(0, 5).map((alert) => {
                    const loan = alert.loans;
                    const borrower = loan?.borrowers;
                    const borrowerName = borrower
                      ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "—"
                      : "—";
                    const isAtRisk = alert.alert_type === "at_risk";
                    return (
                      <TooltipProvider key={alert.id}>
                        <div className={`flex items-center gap-3 rounded-md border p-2.5 hover:bg-accent/50 transition-colors ${
                          alert.severity === "critical" ? "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/10" : ""
                        }`}>
                          <span className="shrink-0">
                            {isAtRisk ? (
                              <ShieldAlert className="h-4 w-4 text-red-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-amber-500" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/loans/${alert.loan_id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {loan?.loan_number ?? alert.loan_id.slice(0, 8)}
                            </Link>
                            <span className="text-xs text-muted-foreground ml-2">{borrowerName}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${
                              isAtRisk
                                ? "border-red-200 text-red-700 dark:text-red-400"
                                : "border-amber-200 text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {isAtRisk ? "At Risk" : "Float-Down"}
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                <Badge
                                  className={`text-xs shrink-0 tabular-nums ${
                                    alert.severity === "critical"
                                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-100"
                                      : alert.severity === "high"
                                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 hover:bg-orange-100"
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100"
                                  }`}
                                >
                                  {alert.rate_delta != null ? `${alert.rate_delta > 0 ? "+" : ""}${alert.rate_delta.toFixed(3)}%` : alert.severity}
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="text-xs">{alert.ai_narrative || "No details"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    );
                  })}
                  {rateAlerts.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-1">
                      +{rateAlerts.length - 5} more alert(s). Open individual loans to see details.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weekly Coaching Digest */}
          {showCoachingDigest && (
            <BranchCoachingDigestCard branchId={coachBranchId} />
          )}

          {/* Manager insight + inactivity control */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Inactivity Aging</CardTitle>
                <CardDescription>
                  Loans untouched for 7+ days trigger reminders; 21+ days trigger escalation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Untouched 7+ days</p>
                    <p className="text-xl font-semibold">{data.untouchedSummary.over7Days}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Untouched 21+ days</p>
                    <p className="text-xl font-semibold text-destructive">{data.untouchedSummary.over21Days}</p>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left">
                        <th className="p-2">Officer</th>
                        <th className="p-2 text-center">Total</th>
                        <th className="p-2 text-center">7+</th>
                        <th className="p-2 text-center">21+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teamActivity.map((row) => (
                        <tr key={row.loanOfficerId} className="border-b last:border-0">
                          <td className="p-2">{row.loanOfficerName}</td>
                          <td className="p-2 text-center">{row.totalLoans}</td>
                          <td className="p-2 text-center">{row.untouched7Plus}</td>
                          <td className="p-2 text-center font-semibold text-destructive">{row.untouched21Plus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manager Insight Agent</CardTitle>
                <CardDescription>
                  Ask operational questions like "who has most stale loans this week?"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {managerInsightAgent.isEnabled ? (
                  <>
                    <Textarea
                      value={insightQuestion}
                      onChange={(e) => setInsightQuestion(e.target.value)}
                      placeholder="Ask about untouched loans, team workload, or branch bottlenecks..."
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={askManagerInsight}
                        disabled={askInsight.isPending || !insightQuestion.trim()}
                      >
                        {askInsight.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Ask insight
                      </Button>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="whitespace-pre-wrap text-sm text-foreground/90">
                        {insightAnswer || "Insight response will appear here."}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Manager Insight Agent is disabled in Admin → Agents.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Team Leaderboard */}
          <LeaderboardWidget />

          {/* Bottlenecks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bottlenecks</CardTitle>
              <CardDescription>Where loans are stalling in your funnel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.bottlenecks.map((bottleneck) => (
                <div key={bottleneck.id} className="rounded-md border bg-card p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{bottleneck.label}</span>
                    <span className="text-sm font-semibold">{bottleneck.loanCount}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{bottleneck.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

