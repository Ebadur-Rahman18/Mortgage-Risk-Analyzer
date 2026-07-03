import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, ArrowLeft } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useMortgageRiskDashboard } from "@/hooks/useMortgageRiskDashboard";
import {
  COPILOT_STATUS_GROUP_LABELS,
  formatRiskLevel,
} from "@/lib/mortgage-calculations";
import { formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(var(--chart-1))",
  under_review: "hsl(var(--chart-2))",
  approved: "hsl(var(--chart-3))",
  rejected: "hsl(var(--chart-4))",
};

const RISK_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export default function MortgageRiskDashboard() {
  const { data: stats, isLoading } = useMortgageRiskDashboard();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const statusChartData = stats
    ? Object.entries(stats.byStatusGroup).map(([key, value]) => ({
        label: COPILOT_STATUS_GROUP_LABELS[key as keyof typeof COPILOT_STATUS_GROUP_LABELS],
        value,
        fill: STATUS_COLORS[key] ?? "hsl(var(--muted))",
      }))
    : [];

  const riskChartData = stats
    ? Object.entries(stats.byRiskLevel).map(([key, value]) => ({
        name: formatRiskLevel(key),
        value,
        fill: RISK_COLORS[key] ?? "#888",
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/loans">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Risk Copilot Dashboard
          </h1>
          <p className="text-muted-foreground">
            Pipeline overview using latest AI analysis per loan
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total loans</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalLoans ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        {riskChartData.map((r) => (
          <Card key={r.name}>
            <CardHeader className="pb-2">
              <CardDescription>{r.name} risk</CardDescription>
              <CardTitle className="text-3xl">{r.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications by status</CardTitle>
            <CardDescription>Grouped pipeline status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusChartData.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk distribution</CardTitle>
            <CardDescription>Latest non-outdated analyses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={riskChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {riskChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {stats?.latestSummaries && stats.latestSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Latest analysis summaries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.latestSummaries.map((s) => (
              <div key={s.loan_number} className="rounded-md border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium">{s.loan_number}</span>
                  <Badge variant="outline">{formatRiskLevel(s.risk_level)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{s.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recently analyzed</CardTitle>
          <CardDescription>Loans with latest Risk Copilot analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Analyzed</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stats?.recentlyAnalyzed ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No analyses yet
                  </TableCell>
                </TableRow>
              ) : (
                stats?.recentlyAnalyzed.map((row) => (
                  <TableRow key={row.loan_id}>
                    <TableCell className="font-medium">{row.loan_number}</TableCell>
                    <TableCell>{row.borrower_name}</TableCell>
                    <TableCell>{row.risk_score}/100</TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatRiskLevel(row.risk_level)}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(row.analyzed_at)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/loans/${row.loan_id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
