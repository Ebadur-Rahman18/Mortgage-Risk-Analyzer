import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useRateAlertByLoan,
  useRunRateAlertScan,
  type RateAlertAnalysis,
} from "@/hooks/useRateAlertIntelligence";
import { cn } from "@/lib/utils";
import {
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  RefreshCw,
  Loader2,
  Mail,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

function severityConfig(severity: string) {
  switch (severity) {
    case "critical":
      return {
        border: "border-red-300 dark:border-red-800",
        bg: "bg-red-50 dark:bg-red-950/30",
        badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        label: "Critical",
      };
    case "high":
      return {
        border: "border-orange-300 dark:border-orange-800",
        bg: "bg-orange-50 dark:bg-orange-950/30",
        badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
        label: "High",
      };
    case "medium":
      return {
        border: "border-amber-300 dark:border-amber-800",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
        label: "Medium",
      };
    case "low":
      return {
        border: "border-yellow-200 dark:border-yellow-800",
        bg: "bg-yellow-50/50 dark:bg-yellow-950/20",
        badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        label: "Low",
      };
    default:
      return {
        border: "border-green-200 dark:border-green-800",
        bg: "bg-green-50/50 dark:bg-green-950/20",
        badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        label: "Stable",
      };
  }
}

function RateDelta({ delta, isAtRisk }: { delta: number; isAtRisk: boolean }) {
  const abs = Math.abs(delta);
  const bps = Math.round(abs * 1000) / 10;
  return (
    <div className="flex items-center gap-1 text-sm font-semibold">
      {isAtRisk ? (
        <ArrowUp className="h-4 w-4 text-red-600" />
      ) : (
        <ArrowDown className="h-4 w-4 text-green-600" />
      )}
      <span className={isAtRisk ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
        {abs.toFixed(3)}% ({bps} bps)
      </span>
    </div>
  );
}

function AlertContent({ alert, loanId }: { alert: RateAlertAnalysis; loanId: string }) {
  const isAtRisk = alert.alert_type === "at_risk";
  const isFloatDown = alert.alert_type === "float_down";
  const sev = severityConfig(alert.severity);

  return (
    <Card className={cn("border-2 transition-colors", sev.border, sev.bg)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {isAtRisk ? (
              <ShieldAlert className="h-5 w-5 text-red-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-amber-600" />
            )}
            {isAtRisk ? "Rate Lock At Risk" : "Float-Down Opportunity"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={cn(sev.badge, "hover:" + sev.badge.split(" ")[0])}>
              {sev.label}
            </Badge>
            {alert.days_remaining != null && alert.days_remaining <= 7 && isAtRisk && (
              <Badge variant="destructive" className="text-xs">
                {alert.days_remaining <= 0 ? "Expired" : `${alert.days_remaining}d left`}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rate comparison */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Locked Rate</p>
            <p className="text-lg font-bold">{alert.locked_rate?.toFixed(3)}%</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-xs text-muted-foreground mb-1">Delta</p>
            <RateDelta delta={alert.rate_delta ?? 0} isAtRisk={isAtRisk} />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Market Rate</p>
            <p className="text-lg font-bold">{alert.current_market_rate?.toFixed(3)}%</p>
          </div>
        </div>

        {/* Days remaining */}
        {alert.days_remaining != null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Lock expires in <strong className="text-foreground">{alert.days_remaining} days</strong></span>
          </div>
        )}

        {/* AI narrative */}
        {alert.ai_narrative && (
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">AI Analysis</p>
            <p className="text-sm leading-relaxed">{alert.ai_narrative}</p>
          </div>
        )}

        {/* AI recommendation */}
        {alert.ai_recommendation && (
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Recommended Action</p>
            <p className="text-sm leading-relaxed">{alert.ai_recommendation}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" asChild>
            <Link to={`/communication-center?loanId=${loanId}&context=rate_alert&alertType=${alert.alert_type}`}>
              <Mail className="mr-2 h-4 w-4" />
              Contact Borrower
            </Link>
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground">
                  Last scanned {formatTimeAgo(new Date(alert.scored_at))}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{new Date(alert.scored_at).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

function StableIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 px-4 py-3">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <span className="text-sm text-green-700 dark:text-green-400 font-medium">
        Rates stable — no action needed
      </span>
    </div>
  );
}

interface RateAlertCardProps {
  loanId: string;
  showScanButton?: boolean;
}

export function RateAlertCard({ loanId, showScanButton = true }: RateAlertCardProps) {
  const { data: alert, isLoading } = useRateAlertByLoan(loanId);
  const runScan = useRunRateAlertScan();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking rate alerts...
      </div>
    );
  }

  const hasAlert = alert && alert.alert_type !== "no_action";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Rate Intelligence</span>
        </div>
        {showScanButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => runScan.mutate()}
            disabled={runScan.isPending}
            className="gap-2"
          >
            {runScan.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Check Rates
          </Button>
        )}
      </div>

      {hasAlert ? (
        <AlertContent alert={alert} loanId={loanId} />
      ) : alert ? (
        <StableIndicator />
      ) : null}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
