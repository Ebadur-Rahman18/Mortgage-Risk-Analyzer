import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useInvestorSubmissionsScoped } from "@/hooks/useInvestorSubmission";
import { Loader2, Truck } from "lucide-react";

export default function InvestorSubmissionsPage() {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const { data: rows = [], isLoading } = useInvestorSubmissionsScoped(applied || undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Truck className="h-6 w-6 text-muted-foreground" />
          Investor submissions
        </h1>
        <p className="text-sm text-muted-foreground">
          Loans in your access scope (RLS). Filter by investor code; open a loan for full delivery workflow
          and documents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>Optional — matches investor code contains.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Investor code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button type="button" variant="secondary" onClick={() => setApplied(search.trim())}>
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setApplied("");
            }}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
          <CardDescription>Up to 500 rows, newest updates first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rows in your scope.</p>
          ) : (
            <div className="overflow-x-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2">Loan</th>
                    <th className="px-2 py-2">Investor</th>
                    <th className="px-2 py-2">Status</th>
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
                      <td className="px-2 py-2">{r.investor_code || "—"}</td>
                      <td className="px-2 py-2 capitalize">{r.status.replace("_", " ")}</td>
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
    </div>
  );
}
