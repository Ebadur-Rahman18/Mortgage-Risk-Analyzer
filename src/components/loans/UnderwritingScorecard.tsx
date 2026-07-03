import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useUnderwritingPrecheckHistory,
  useRunUnderwritingPrecheck,
  type PrecheckItem,
  type UnderwritingPrecheckRow,
} from "@/hooks/useUnderwritingPrecheck";
import { formatDate, cn } from "@/lib/utils";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileDown,
  History,
  RefreshCw,
  Sparkles,
} from "lucide-react";

function resultColor(result: string) {
  switch (result) {
    case "pass":
      return "border-l-green-500 bg-green-50/50 dark:bg-green-950/20";
    case "warning":
      return "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20";
    case "fail":
      return "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
    default:
      return "";
  }
}

function resultBadge(result: string) {
  switch (result) {
    case "pass":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100">Pass</Badge>;
    case "warning":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100">Warning</Badge>;
    case "fail":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-100">Fail</Badge>;
    default:
      return <Badge variant="outline">{result}</Badge>;
  }
}

function overallIcon(result: string) {
  switch (result) {
    case "pass":
      return <ShieldCheck className="h-6 w-6 text-green-600" />;
    case "warning":
      return <ShieldAlert className="h-6 w-6 text-amber-500" />;
    case "fail":
      return <ShieldX className="h-6 w-6 text-red-500" />;
    default:
      return null;
  }
}

function CheckRow({ check }: { check: PrecheckItem }) {
  const [open, setOpen] = useState(false);
  const hasDetail = check.issue_note || check.remediation;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 border-l-4 rounded-md text-left transition-colors hover:bg-accent/50",
            resultColor(check.result),
          )}
          disabled={!hasDetail}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{check.label}</span>
              {resultBadge(check.result)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {check.actual_value} · Threshold: {check.threshold}
            </p>
          </div>
          {hasDetail && (
            open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      {hasDetail && (
        <CollapsibleContent className="pl-8 pr-4 pb-3 space-y-2">
          {check.issue_note && (
            <div className="text-sm">
              <span className="font-medium">Issue: </span>
              {check.issue_note}
            </div>
          )}
          {check.guideline && (
            <p className="text-xs text-muted-foreground">Guideline: {check.guideline}</p>
          )}
          {check.remediation && (
            <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-2.5 text-sm">
              <div className="flex items-center gap-1.5 mb-1 text-blue-700 dark:text-blue-400">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="font-medium text-xs uppercase tracking-wide">AI Remediation</span>
              </div>
              <p className="text-blue-900 dark:text-blue-100">{check.remediation}</p>
            </div>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ScorecardContent({
  data,
  onExportPdf,
}: {
  data: UnderwritingPrecheckRow;
  onExportPdf?: () => void;
}) {
  const [summaryOpen, setSummaryOpen] = useState(true);

  return (
    <div className="space-y-4">
      {/* Overall banner */}
      <div className={cn(
        "flex items-center gap-3 rounded-lg p-4 border",
        data.overall_result === "pass" && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
        data.overall_result === "warning" && "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
        data.overall_result === "fail" && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
      )}>
        {overallIcon(data.overall_result)}
        <div className="flex-1">
          <p className="font-semibold capitalize">{data.overall_result === "pass" ? "Ready for Submission" : data.overall_result === "warning" ? "Review Recommended" : "Not Ready — Issues Found"}</p>
          <p className="text-sm text-muted-foreground">
            {data.pass_count} pass · {data.warn_count} warning · {data.fail_count} fail
            {data.latency_ms != null && ` · ${(data.latency_ms / 1000).toFixed(1)}s`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(data.created_at)}</p>
      </div>

      {/* AI Summary */}
      {data.ai_summary && (
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium hover:underline underline-offset-4 w-full text-left">
              <Sparkles className="h-4 w-4 text-blue-600" />
              AI Summary
              {summaryOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
              {data.ai_summary}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Check rows */}
      <div className="space-y-2" id="precheck-scorecard-rows">
        {(data.checks as PrecheckItem[]).map((check) => (
          <CheckRow key={check.category} check={check} />
        ))}
      </div>

      {/* Footer */}
      {onExportPdf && (
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onExportPdf} className="gap-2">
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      )}
    </div>
  );
}

interface UnderwritingScorecardProps {
  loanId: string;
  loanNumber?: string;
  borrowerName?: string;
}

export function UnderwritingScorecard({
  loanId,
  loanNumber,
  borrowerName,
}: UnderwritingScorecardProps) {
  const { data: history, isLoading: historyLoading } = useUnderwritingPrecheckHistory(loanId);
  const runPrecheck = useRunUnderwritingPrecheck();
  const [showHistory, setShowHistory] = useState(false);

  const latest = history?.[0] ?? null;
  const pastRuns = history?.slice(1) ?? [];

  const handleExportPdf = async (row: UnderwritingPrecheckRow) => {
    try {
      const { generatePrecheckPdf } = await import("@/lib/precheckPdfExport");
      generatePrecheckPdf(row, loanNumber, borrowerName);
    } catch {
      const { toast } = await import("sonner");
      toast.error("PDF export failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Underwriting Pre-Check</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {pastRuns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="gap-1.5"
              >
                <History className="h-3.5 w-3.5" />
                {showHistory ? "Hide" : `${pastRuns.length} past`}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => runPrecheck.mutate(loanId)}
              disabled={runPrecheck.isPending}
              className="gap-2"
            >
              {runPrecheck.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {latest ? "Re-run" : "Run Pre-Check"}
            </Button>
          </div>
        </div>
        <CardDescription>
          Automated scan against underwriting guidelines — DTI, LTV, credit, conditions, and more.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {historyLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : runPrecheck.isPending && !latest ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Running pre-check…</p>
          </div>
        ) : !latest ? (
          <div className="text-center py-8">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground mb-3">
              No pre-check has been run for this loan yet.
            </p>
            <Button
              onClick={() => runPrecheck.mutate(loanId)}
              disabled={runPrecheck.isPending}
              className="gap-2"
            >
              {runPrecheck.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Run Pre-Check
            </Button>
          </div>
        ) : (
          <>
            <ScorecardContent data={latest} onExportPdf={() => handleExportPdf(latest)} />

            {showHistory && pastRuns.length > 0 && (
              <div className="mt-6 space-y-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Previous Runs</h4>
                {pastRuns.map((run) => (
                  <Collapsible key={run.id}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 w-full text-left rounded-md border p-3 hover:bg-accent/50 transition-colors">
                        {overallIcon(run.overall_result)}
                        <div className="flex-1">
                          <span className="text-sm font-medium capitalize">{run.overall_result}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {run.pass_count}P / {run.warn_count}W / {run.fail_count}F
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(run.created_at)}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <ScorecardContent data={run} onExportPdf={() => handleExportPdf(run)} />
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
