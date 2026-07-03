import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  usePipelinePriorityScores,
  useRunPipelinePrioritization,
  type PipelinePriorityScore,
} from "@/hooks/usePipelinePriority";
import { cn } from "@/lib/utils";
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  TrendingUp,
  Users,
  Target,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { useState } from "react";

function urgencyBadge(score: number) {
  if (score >= 70) {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-100 tabular-nums font-semibold">
        {score}
      </Badge>
    );
  }
  if (score >= 40) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100 tabular-nums font-semibold">
        {score}
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100 tabular-nums font-semibold">
      {score}
    </Badge>
  );
}

function riskLevelBadge(level: string | undefined) {
  switch (level) {
    case "critical":
      return <Badge variant="destructive" className="text-[10px]">Critical</Badge>;
    case "high":
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 hover:bg-orange-100 text-[10px]">High</Badge>;
    case "medium":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100 text-[10px]">Medium</Badge>;
    case "low":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100 text-[10px]">Low</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">—</Badge>;
  }
}

function SubScoreBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-4">{icon}</span>
      <span className="w-28 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            value >= 70 ? "bg-red-500" : value >= 40 ? "bg-amber-500" : "bg-green-500",
          )}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="w-8 text-right tabular-nums font-medium">{value}</span>
    </div>
  );
}

function PriorityRow({ item, rank }: { item: PipelinePriorityScore; rank: number }) {
  const [open, setOpen] = useState(false);
  const loan = item.loans;
  const borrower = loan?.borrowers;
  const borrowerName = borrower
    ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "—"
    : "—";
  const riskLevel = loan?.loan_risk_scores?.risk_level;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <>
        <TableRow className={cn(item.urgency_score >= 70 && "bg-red-50/30 dark:bg-red-950/10")}>
          <TableCell className="text-center font-medium text-muted-foreground w-12">
            {rank}
          </TableCell>
          <TableCell className="font-medium">
            <Link
              to={`/loans/${item.loan_id}`}
              className="text-primary hover:underline"
            >
              {loan?.loan_number ?? item.loan_id.slice(0, 8)}
            </Link>
          </TableCell>
          <TableCell>{borrowerName}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs capitalize">
              {loan?.status ?? "—"}
            </Badge>
          </TableCell>
          <TableCell>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">{urgencyBadge(item.urgency_score)}</span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-sm font-medium mb-1">Why this is urgent</p>
                  <p className="text-xs">{item.urgency_reason || "No details available"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableCell>
          <TableCell>{riskLevelBadge(riskLevel)}</TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {loan?.lock_expiration_date
              ? new Date(loan.lock_expiration_date).toLocaleDateString()
              : "—"}
          </TableCell>
          <TableCell className="text-right">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </TableCell>
        </TableRow>
        <CollapsibleContent asChild>
          <TableRow className="bg-muted/20">
            <TableCell colSpan={8} className="py-3 px-6">
              <div className="grid gap-3 md:grid-cols-2 max-w-2xl">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sub-Scores</p>
                  <SubScoreBar label="SLA Risk" value={Number(item.sla_risk_sub)} icon={<ShieldAlert className="h-3 w-3" />} />
                  <SubScoreBar label="Lock Expiry" value={Number(item.lock_expiry_sub)} icon={<Clock className="h-3 w-3" />} />
                  <SubScoreBar label="Engagement" value={Number(item.engagement_sub)} icon={<Users className="h-3 w-3" />} />
                  <SubScoreBar label="Close Prob." value={Number(item.close_probability_sub)} icon={<Target className="h-3 w-3" />} />
                </div>
                <div className="space-y-2">
                  {item.ai_engagement_note && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Engagement</p>
                      <p className="text-xs">{item.ai_engagement_note}</p>
                    </div>
                  )}
                  {item.ai_close_note && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Close Readiness</p>
                      <p className="text-xs">{item.ai_close_note}</p>
                    </div>
                  )}
                </div>
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}

export function PriorityQueueView() {
  const { data: scores, isLoading } = usePipelinePriorityScores();
  const runPrioritization = useRunPipelinePrioritization();

  const lastScored = scores?.[0]?.scored_at;
  const agoText = lastScored
    ? formatTimeAgo(new Date(lastScored))
    : null;

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Priority Queue</span>
          {agoText && (
            <span className="text-xs text-muted-foreground">
              · Last ranked {agoText}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => runPrioritization.mutate()}
          disabled={runPrioritization.isPending}
          className="gap-2"
        >
          {runPrioritization.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Re-rank Pipeline
        </Button>
      </div>

      {!scores || scores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <TrendingUp className="h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No priority scores yet.</p>
          <Button
            onClick={() => runPrioritization.mutate()}
            disabled={runPrioritization.isPending}
            className="gap-2"
          >
            {runPrioritization.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Rank My Pipeline
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Loan #</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Lock Exp.</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((item, idx) => (
              <PriorityRow key={item.id} item={item} rank={idx + 1} />
            ))}
          </TableBody>
        </Table>
      )}
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
