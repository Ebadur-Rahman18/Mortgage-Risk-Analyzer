import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHedgeAssumptions, useHedgeSnapshots, useComputeHedgeSnapshot } from "@/hooks/useHedgeAnalytics";
import { Loader2, LineChart } from "lucide-react";
import { toast } from "sonner";

export default function HedgeAnalyticsPage() {
  const { data: assumptions = [], isLoading: loadA } = useHedgeAssumptions();
  const { data: snapshots = [], isLoading: loadS } = useHedgeSnapshots();
  const compute = useComputeHedgeSnapshot();
  const [benchmarkSymbol, setBenchmarkSymbol] = useState("");

  const pullThroughPct = useMemo(() => {
    const active = assumptions.find((a) => a.is_active) ?? assumptions[0];
    const p = active?.assumptions?.pull_through_pct;
    return typeof p === "number" && !Number.isNaN(p) ? p : 0.75;
  }, [assumptions]);

  const chartData = useMemo(() => {
    if (!snapshots.length) return [];
    return [...snapshots].slice(0, 24).reverse().map((s) => {
      const vol = Number(s.locked_volume ?? 0);
      return {
        date: s.snapshot_date,
        locked: Math.round(vol),
        impliedClosed: Math.round(vol * pullThroughPct),
      };
    });
  }, [snapshots, pullThroughPct]);

  const run = async () => {
    try {
      await compute.mutateAsync({
        optionalSymbol: benchmarkSymbol.trim() || null,
      });
      toast.success("Snapshot saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compute failed");
    }
  };

  const exportCsv = () => {
    const headers = ["snapshot_date", "locked_volume", "active_lock_count", "unique_loans", "optional_symbol"];
    const lines = snapshots.map((s) => {
      const u = (s.totals?.unique_loans_locked as number | undefined) ?? "";
      return [
        s.snapshot_date,
        s.locked_volume ?? "",
        s.active_lock_count ?? "",
        u,
        s.optional_symbol ?? "",
      ].join(",");
    });
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hedge-snapshots-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <LineChart className="h-6 w-6 text-muted-foreground" />
          Hedge analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Illustrative locked-pipeline view from active rate locks. Not a trading or hedge advisory tool.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="hedge-benchmark">Benchmark label (optional)</Label>
          <Input
            id="hedge-benchmark"
            placeholder="e.g. FNMA 6.0"
            value={benchmarkSymbol}
            onChange={(e) => setBenchmarkSymbol(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Stored on the snapshot row for future vendor marks.</p>
        </div>
        <Button type="button" onClick={() => void run()} disabled={compute.isPending}>
          {compute.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Compute snapshot from locks
        </Button>
        <Button type="button" variant="outline" onClick={exportCsv} disabled={!snapshots.length}>
          Export CSV
        </Button>
      </div>

      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume vs. pull-through assumption</CardTitle>
            <CardDescription>
              Bars: locked pipeline volume per snapshot. Line: volume × active assumption pull-through (
              {Math.round(pullThroughPct * 100)}% default if unset).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value: number, name) => [
                      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                        value,
                      ),
                      name === "locked" ? "Locked volume" : "Implied closed (× pull-through)",
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="locked" name="Locked volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="impliedClosed"
                    name="Implied closed"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active assumptions</CardTitle>
            <CardDescription>Admin-maintained scenario inputs (JSON).</CardDescription>
          </CardHeader>
          <CardContent>
            {loadA ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ul className="text-sm space-y-2">
                {assumptions.map((a) => (
                  <li key={a.id} className="rounded border p-2">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">Effective {a.effective_date}</div>
                    <pre className="text-xs mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(a.assumptions, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent snapshots</CardTitle>
            <CardDescription>One row per compute — volume sums non-closed loans with active locks.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadS ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snapshots yet.</p>
            ) : (
              <div className="overflow-x-auto text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Volume</th>
                      <th className="py-2 pr-2">Locks</th>
                      <th className="py-2 pr-2">Loans</th>
                      <th className="py-2">Symbol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">{s.snapshot_date}</td>
                        <td className="py-2 pr-2">
                          {s.locked_volume != null
                            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                                Number(s.locked_volume),
                              )
                            : "—"}
                        </td>
                        <td className="py-2 pr-2">{s.active_lock_count ?? "—"}</td>
                        <td className="py-2 pr-2">{(s.totals?.unique_loans_locked as number) ?? "—"}</td>
                        <td className="py-2 text-xs">{s.optional_symbol ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
