import { useState } from "react";
import {
  Trophy,
  Medal,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useLeaderboard,
  useComputeLeaderboard,
  getISOWeekLabel,
  getMonthLabel,
  type LeaderboardScore,
} from "@/hooks/useLeaderboard";

const RANK_STYLES: Record<number, { bg: string; icon: React.ElementType }> = {
  1: { bg: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700", icon: Trophy },
  2: { bg: "bg-slate-100 dark:bg-slate-800/30 border-slate-300 dark:border-slate-600", icon: Medal },
  3: { bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800", icon: Medal },
};

function RankMovement({ rank, prevRank }: { rank: number | null; prevRank: number | null }) {
  if (rank == null || prevRank == null) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  const diff = prevRank - rank;
  if (diff > 0) {
    return (
      <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
        <ArrowUp className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">{diff}</span>
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400">
        <ArrowDown className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">{Math.abs(diff)}</span>
      </span>
    );
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function SubScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">
          {label}: {typeof value === "number" ? value.toFixed(1) : value}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export function LeaderboardWidget() {
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const now = new Date();
  const periodLabel =
    periodType === "weekly" ? getISOWeekLabel(now) : getMonthLabel(now);

  const { data: scores = [], isLoading } = useLeaderboard(periodType, periodLabel);
  const computeMut = useComputeLeaderboard();

  const handleRefresh = () => {
    computeMut.mutate({ period_type: periodType });
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Team Leaderboard
          <Badge variant="outline" className="text-[10px] font-normal ml-1">
            {periodLabel}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            size="sm"
            value={periodType}
            onValueChange={(v) => v && setPeriodType(v as "weekly" | "monthly")}
          >
            <ToggleGroupItem value="weekly" className="text-xs px-2 h-7">
              Weekly
            </ToggleGroupItem>
            <ToggleGroupItem value="monthly" className="text-xs px-2 h-7">
              Monthly
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={handleRefresh}
            disabled={computeMut.isPending}
          >
            {computeMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : scores.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No scores computed yet for this period.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={handleRefresh}
              disabled={computeMut.isPending}
            >
              Compute Now
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {scores.map((s: LeaderboardScore, idx: number) => {
              const rankStyle = RANK_STYLES[s.rank ?? 0];
              const RankIcon = rankStyle?.icon;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-all",
                    rankStyle?.bg ?? "",
                    idx < 3 && "font-medium",
                  )}
                >
                  {/* Rank */}
                  <div className="flex items-center gap-1.5 w-10 shrink-0">
                    {RankIcon ? (
                      <RankIcon
                        className={cn(
                          "h-4 w-4",
                          s.rank === 1 && "text-yellow-600 dark:text-yellow-400",
                          s.rank === 2 && "text-slate-500 dark:text-slate-400",
                          s.rank === 3 && "text-amber-600 dark:text-amber-500",
                        )}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground font-mono w-4 text-center">
                        {s.rank}
                      </span>
                    )}
                    <RankMovement rank={s.rank} prevRank={s.prev_rank} />
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{(s as any).user_id?.slice(0, 8)}</p>
                    {/* Sub-score mini bars */}
                    <div className="flex gap-1 mt-1">
                      <SubScoreBar label="Closed" value={s.closed_count} max={25} />
                      <SubScoreBar label="Pipeline" value={s.pipeline_volume / 100000} max={50} />
                      <SubScoreBar label="On-time" value={s.on_time_rate} max={100} />
                      <SubScoreBar label="Speed" value={Math.max(0, 10 - s.conditions_speed_avg_days)} max={10} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span>{s.closed_count} closed</span>
                    <span>{formatCurrency(s.pipeline_volume)}</span>
                    <span>{s.on_time_rate.toFixed(0)}%</span>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    <span className="text-lg font-bold tabular-nums">
                      {s.composite_score.toFixed(0)}
                    </span>
                    <p className="text-[10px] text-muted-foreground">pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
