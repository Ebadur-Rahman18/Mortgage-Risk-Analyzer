// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Landmark, Download } from "lucide-react";
import { useHmdaByYear, useLogHmdaRun, useHmdaReportRuns } from "@/hooks/usePhase7Compliance";
import { toast } from "sonner";

export default function HmdaReporting() {
  const [yearInput, setYearInput] = useState(new Date().getFullYear().toString());
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: rows = [], isLoading } = useHmdaByYear(year);
  const { data: runs = [] } = useHmdaReportRuns();
  const logRun = useLogHmdaRun();

  const reportable = useMemo(() => rows.filter((r) => r.is_reportable), [rows]);
  const excluded = rows.length - reportable.length;

  const exportCsv = async () => {
    const headers = [
      "loan_id",
      "loan_number",
      "filing_year",
      "action_taken",
      "action_taken_date",
      "loan_purpose",
      "loan_type",
      "occupancy_type",
      "lien_status",
      "purchaser_type",
      "hoepa_status",
      "rate_spread",
      "denial_reasons",
      "updated_at",
    ];

    const csvRows = reportable.map((r) => {
      const denial = Array.isArray(r.denial_reasons)
        ? r.denial_reasons.filter((x: unknown) => typeof x === "string").join(" | ")
        : "";
      const cells = [
        r.loan_id,
        r.loans?.loan_number ?? "",
        String(r.filing_year ?? ""),
        r.action_taken ?? "",
        r.action_taken_date ?? "",
        r.loan_purpose ?? "",
        r.loan_type ?? "",
        r.occupancy_type ?? "",
        r.lien_status ?? "",
        r.purchaser_type ?? "",
        r.hoepa_status ?? "",
        r.rate_spread != null ? String(r.rate_spread) : "",
        denial,
        r.updated_at ?? "",
      ];
      return cells
        .map((c) => `"${String(c).replaceAll('"', '""')}"`)
        .join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hmda-lar-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    try {
      await logRun.mutateAsync({
        filing_year: year,
        total_rows: rows.length,
        included_rows: reportable.length,
        excluded_rows: excluded,
        filters: { filing_year: year, reportable_only: true },
        summary: { generated_at: new Date().toISOString() },
      });
      toast.success("HMDA export generated and logged.");
    } catch {
      toast.error("Export generated, but run log failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Landmark className="h-6 w-6 text-muted-foreground" />
          HMDA reporting
        </h1>
        <p className="text-sm text-muted-foreground">
          Review HMDA LAR fields captured on loans and export reportable rows for filing workbooks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run report</CardTitle>
          <CardDescription>Select filing year and export reportable records.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Filing year</label>
            <Input className="w-36" value={yearInput} onChange={(e) => setYearInput(e.target.value)} />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              const n = Number(yearInput);
              if (Number.isNaN(n) || n < 1990 || n > 2100) return toast.error("Invalid year");
              setYear(n);
            }}
          >
            Apply
          </Button>
          <Button onClick={() => void exportCsv()} disabled={isLoading || reportable.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Badge variant="outline">Rows: {rows.length}</Badge>
          <Badge variant="outline">Reportable: {reportable.length}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan-level HMDA rows</CardTitle>
          <CardDescription>Newest updates first for year {year}.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No HMDA rows found for selected year.</p>
          ) : (
            <div className="overflow-x-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2">Loan</th>
                    <th className="px-2 py-2">Action</th>
                    <th className="px-2 py-2">Purpose</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <Link className="font-medium text-primary hover:underline" to={`/loans/${r.loan_id}`}>
                          {r.loans?.loan_number ?? r.loan_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-2 py-2">{r.action_taken?.replaceAll("_", " ") ?? "—"}</td>
                      <td className="px-2 py-2">{r.loan_purpose?.replaceAll("_", " ") ?? "—"}</td>
                      <td className="px-2 py-2">{r.loan_type ?? "—"}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {new Date(r.updated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent report runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No runs logged yet.</p>
          ) : (
            runs.map((r) => (
              <div key={r.id} className="rounded border p-2 flex items-center justify-between gap-2">
                <span>
                  {r.filing_year} · included {r.included_rows}/{r.total_rows}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
