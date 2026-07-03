// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type {
  PipelineStageStat,
  RiskHeatmapRow,
  ManagerDashboardData,
} from "@/hooks/useManagerDashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const PIPELINE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#06b6d4",
  "#14b8a6", "#22c55e", "#eab308", "#f97316",
  "#ef4444", "#ec4899", "#64748b",
];

const STATUS_LABELS: Record<string, string> = {
  application: "Application",
  processing: "Processing",
  underwriting: "Underwriting",
  conditional_approval: "Cond. Approval",
  clear_to_close: "Clear to Close",
  closing: "Closing",
  funded: "Funded",
  closed: "Closed",
  denied: "Denied",
  withdrawn: "Withdrawn",
  suspended: "Suspended",
};

function labelForStatus(raw: string) {
  return STATUS_LABELS[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ── Risk Distribution Donut ─────────────────────────────────────────────────

interface RiskDonutProps {
  riskByOfficer: RiskHeatmapRow[];
}

export function RiskDistributionDonut({ riskByOfficer }: RiskDonutProps) {
  const totals = useMemo(() => {
    const agg = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const row of riskByOfficer) {
      agg.low += row.low;
      agg.medium += row.medium;
      agg.high += row.high;
      agg.critical += row.critical;
    }
    return [
      { name: "Low", value: agg.low, color: RISK_COLORS.low },
      { name: "Medium", value: agg.medium, color: RISK_COLORS.medium },
      { name: "High", value: agg.high, color: RISK_COLORS.high },
      { name: "Critical", value: agg.critical, color: RISK_COLORS.critical },
    ].filter((d) => d.value > 0);
  }, [riskByOfficer]);

  const total = totals.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No risk data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Risk Distribution</CardTitle>
        <CardDescription>Aggregate risk across all officers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={totals}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {totals.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number, name: string) => [
                  `${value} loan${value !== 1 ? "s" : ""} (${Math.round((value / total) * 100)}%)`,
                  name,
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--card-foreground))",
                  fontSize: "12px",
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-xs text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-2xl font-bold mt-1">{total}</p>
        <p className="text-center text-xs text-muted-foreground">Total scored loans</p>
      </CardContent>
    </Card>
  );
}

// ── Pipeline Funnel Bar Chart ───────────────────────────────────────────────

interface PipelineFunnelProps {
  pipeline: PipelineStageStat[];
}

export function PipelineFunnelChart({ pipeline }: PipelineFunnelProps) {
  const data = useMemo(
    () =>
      pipeline.map((s, i) => ({
        stage: labelForStatus(s.status),
        count: s.count,
        fill: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
      })),
    [pipeline],
  );

  if (data.length === 0) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Pipeline Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pipeline data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pipeline Funnel</CardTitle>
        <CardDescription>Loans by stage within your scope</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              type="category"
              dataKey="stage"
              width={110}
              tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
            />
            <RechartsTooltip
              formatter={(value: number) => [`${value} loan${value !== 1 ? "s" : ""}`, "Count"]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--card-foreground))",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
              {data.map((entry) => (
                <Cell key={entry.stage} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Officer Workload Stacked Bar ────────────────────────────────────────────

interface OfficerWorkloadProps {
  riskByOfficer: RiskHeatmapRow[];
}

export function OfficerWorkloadChart({ riskByOfficer }: OfficerWorkloadProps) {
  const data = useMemo(() => {
    const sorted = [...riskByOfficer].sort((a, b) => b.totalLoans - a.totalLoans);
    return sorted.slice(0, 12).map((row) => ({
      name: row.loanOfficerName.length > 14
        ? row.loanOfficerName.slice(0, 12) + "…"
        : row.loanOfficerName,
      fullName: row.loanOfficerName,
      low: row.low,
      medium: row.medium,
      high: row.high,
      critical: row.critical,
    }));
  }, [riskByOfficer]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Officer Workload</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No officer data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Officer Workload & Risk</CardTitle>
        <CardDescription>Loan count by risk level per officer</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <RechartsTooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--card-foreground))",
                fontSize: "12px",
              }}
              labelFormatter={(_label, payload) => {
                const item = payload?.[0]?.payload;
                return item?.fullName ?? _label;
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span className="text-xs capitalize text-foreground">{value}</span>
              )}
            />
            <Bar dataKey="low" stackId="risk" fill={RISK_COLORS.low} radius={[0, 0, 0, 0]} />
            <Bar dataKey="medium" stackId="risk" fill={RISK_COLORS.medium} />
            <Bar dataKey="high" stackId="risk" fill={RISK_COLORS.high} />
            <Bar dataKey="critical" stackId="risk" fill={RISK_COLORS.critical} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Action List ─────────────────────────────────────────────────────────────

interface ActionHitlistProps {
  data: ManagerDashboardData;
}

interface HitlistEntry {
  rank: number;
  type: "officer" | "loan";
  id: string;
  label: string;
  sublabel: string;
  score: number;
  urgencyTag: string;
  urgencyColor: string;
  loanId?: string;
}

export function ActionHitlist({ data }: ActionHitlistProps) {
  const entries = useMemo(() => {
    const items: HitlistEntry[] = [];
    let rank = 0;

    const officersSorted = [...data.teamActivity]
      .filter((o) => o.untouched7Plus > 0)
      .sort((a, b) => {
        const scoreA = a.untouched21Plus * 3 + a.untouched7Plus;
        const scoreB = b.untouched21Plus * 3 + b.untouched7Plus;
        return scoreB - scoreA;
      });

    for (const officer of officersSorted.slice(0, 5)) {
      rank += 1;
      const score = officer.untouched21Plus * 3 + officer.untouched7Plus;
      const has21 = officer.untouched21Plus > 0;
      items.push({
        rank,
        type: "officer",
        id: officer.loanOfficerId,
        label: officer.loanOfficerName,
        sublabel: `${officer.untouched7Plus} stale (${officer.untouched21Plus} escalated) of ${officer.totalLoans} loans`,
        score,
        urgencyTag: has21 ? "Escalate" : "Remind",
        urgencyColor: has21
          ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
      });
    }

    const critLoans = data.atRiskLoansDetail
      .filter((l) => l.riskLevel === "critical")
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    const highLoans = data.atRiskLoansDetail
      .filter((l) => l.riskLevel === "high")
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    for (const loan of [...critLoans, ...highLoans].slice(0, 5)) {
      rank += 1;
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(loan.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      const isCrit = loan.riskLevel === "critical";
      items.push({
        rank,
        type: "loan",
        id: loan.loanId,
        loanId: loan.loanId,
        label: loan.loanNumber,
        sublabel: `${loan.loanOfficerName} · ${loan.loanStatus} · ${daysSinceUpdate}d since update`,
        score: isCrit ? 90 + daysSinceUpdate : 60 + daysSinceUpdate,
        urgencyTag: isCrit ? "Critical" : "High Risk",
        urgencyColor: isCrit
          ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
          : "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
      });
    }

    items.sort((a, b) => b.score - a.score);
    return items.slice(0, 10).map((item, i) => ({ ...item, rank: i + 1 }));
  }, [data]);

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action List</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No urgent items — all officers and loans are in good standing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-300">
            !
          </span>
          Action List
        </CardTitle>
        <CardDescription>
          Top items to act on first — officers with stale pipelines and highest-risk loans, ranked by urgency.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={`${entry.type}-${entry.id}`}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {entry.rank}
              </span>
              <div className="min-w-0 flex-1">
                {entry.type === "loan" ? (
                  <a
                    href={`/loans/${entry.loanId}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {entry.label}
                  </a>
                ) : (
                  <span className="text-sm font-semibold text-foreground">{entry.label}</span>
                )}
                <p className="truncate text-xs text-muted-foreground">{entry.sublabel}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${entry.urgencyColor}`}
              >
                {entry.urgencyTag}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
