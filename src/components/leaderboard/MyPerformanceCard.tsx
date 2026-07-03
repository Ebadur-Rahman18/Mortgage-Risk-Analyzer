import { useState } from "react";
import {
  TrendingUp,
  Loader2,
  DollarSign,
  CheckCircle2,
  Timer,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  useMyScore,
  useOfficerBadges,
  useAllBadgeDefinitions,
  getISOWeekLabel,
  getMonthLabel,
  type LeaderboardScore,
} from "@/hooks/useLeaderboard";
import { BadgeCollection } from "./BadgeCollection";

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border p-3">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          accent || "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export function MyPerformanceCard() {
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const { data: scores, isLoading } = useMyScore();
  const { data: badges = [] } = useOfficerBadges();
  const { data: badgeDefs = [] } = useAllBadgeDefinitions();

  const now = new Date();
  const currentPeriodLabel =
    periodType === "weekly" ? getISOWeekLabel(now) : getMonthLabel(now);

  const score: LeaderboardScore | null =
    (periodType === "weekly" ? scores?.weekly : scores?.monthly) ?? null;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          My Performance
        </CardTitle>
        <ToggleGroup
          type="single"
          size="sm"
          value={periodType}
          onValueChange={(v) => v && setPeriodType(v as "weekly" | "monthly")}
        >
          <ToggleGroupItem value="weekly" className="text-xs px-2 h-7">
            Week
          </ToggleGroupItem>
          <ToggleGroupItem value="monthly" className="text-xs px-2 h-7">
            Month
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !score ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scores for this period yet. Scores are refreshed by your manager.
          </p>
        ) : (
          <>
            {/* Composite score */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {score.composite_score.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Composite Score · {score.period_label}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  score.composite_score >= 80 &&
                    "border-green-500 text-green-700 dark:text-green-400",
                  score.composite_score >= 50 &&
                    score.composite_score < 80 &&
                    "border-amber-500 text-amber-700 dark:text-amber-400",
                  score.composite_score < 50 &&
                    "border-red-500 text-red-700 dark:text-red-400",
                )}
              >
                {score.composite_score >= 80
                  ? "Excellent"
                  : score.composite_score >= 50
                    ? "Good"
                    : "Needs Improvement"}
              </Badge>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                icon={CheckCircle2}
                label="Loans Closed"
                value={String(score.closed_count)}
                accent="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              />
              <StatTile
                icon={DollarSign}
                label="Pipeline Volume"
                value={formatCurrency(score.pipeline_volume)}
                accent="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              />
              <StatTile
                icon={BarChart3}
                label="On-Time Rate"
                value={`${score.on_time_rate.toFixed(0)}%`}
                accent="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
              />
              <StatTile
                icon={Timer}
                label="Avg Condition Days"
                value={
                  score.conditions_speed_avg_days > 0
                    ? `${score.conditions_speed_avg_days.toFixed(1)}d`
                    : "—"
                }
                accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              />
            </div>
          </>
        )}

        {/* Badges */}
        {badgeDefs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Achievements
            </p>
            <BadgeCollection
              earnedBadges={badges}
              allDefinitions={badgeDefs}
              currentPeriodLabel={currentPeriodLabel}
              size="sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
