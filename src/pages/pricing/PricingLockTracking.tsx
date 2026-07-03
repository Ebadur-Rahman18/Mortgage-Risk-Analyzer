import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useRateLocksByLoan, useRateLocksInScope } from "@/hooks/usePricing";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

export default function PricingLockTracking() {
  const [loanId, setLoanId] = useState("");
  const { data, isLoading } = useRateLocksByLoan(loanId || undefined);
  const { data: scoped = [], isLoading: scopeLoading } = useRateLocksInScope();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lock Tracking</h1>
        <p className="text-sm text-muted-foreground">
          By loan or locks visible in your RLS scope (branch / officer, up to 200 active pipeline locks).
        </p>
      </div>

      <Tabs defaultValue="loan" className="space-y-4">
        <TabsList>
          <TabsTrigger value="loan">By loan ID</TabsTrigger>
          <TabsTrigger value="scope">Locks in my scope</TabsTrigger>
        </TabsList>

        <TabsContent value="loan" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Search by Loan ID</CardTitle>
              <CardDescription>Enter a loan ID to view its locks and history.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Loan ID"
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate Locks</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !loanId ? (
                <p className="text-sm text-muted-foreground">Enter a loan ID above to load locks.</p>
              ) : !data || data.locks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No locks found for this loan.</p>
              ) : (
                <div className="overflow-x-auto text-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Locked Rate</th>
                        <th className="px-3 py-2">Lock Date</th>
                        <th className="px-3 py-2">Expiration</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.locks.map((lock: Record<string, unknown>) => (
                        <tr key={String(lock.id)} className="border-b last:border-0">
                          <td className="px-3 py-2">{String(lock.product_name)}</td>
                          <td className="px-3 py-2 text-xs">
                            {lock.locked_rate != null
                              ? `${Number(lock.locked_rate).toFixed(3)}%`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs">{String(lock.lock_date)}</td>
                          <td className="px-3 py-2 text-xs">{String(lock.lock_expiration)}</td>
                          <td className="px-3 py-2 text-xs capitalize">{String(lock.status)}</td>
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
              <CardTitle>Lock History</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !loanId ? (
                <p className="text-sm text-muted-foreground">Enter a loan ID above to load lock history.</p>
              ) : !data || data.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lock history for this loan yet.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {data.history.map((h: Record<string, unknown>) => (
                    <div key={String(h.id)} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium capitalize">{String(h.action_type)}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(String(h.performed_at)).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Previous rate:{" "}
                        {h.previous_rate != null ? `${Number(h.previous_rate).toFixed(3)}%` : "—"} • New rate:{" "}
                        {h.new_rate != null ? `${Number(h.new_rate).toFixed(3)}%` : "—"}
                      </div>
                      {h.extension_days ? (
                        <div className="text-xs text-muted-foreground">Extension: {String(h.extension_days)} days</div>
                      ) : null}
                      {h.notes ? <div className="text-xs mt-1">{String(h.notes)}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Locks in my scope</CardTitle>
              <CardDescription>
                Active, extended, or relocked rows with upcoming expirations prioritized in your access
                scope.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scopeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : scoped.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pipeline locks found.</p>
              ) : (
                <div className="overflow-x-auto text-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2">Loan</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Rate</th>
                        <th className="px-3 py-2">Expiration</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoped.map((lock) => (
                        <tr key={lock.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <Link className="text-primary underline font-medium" to={`/loans/${lock.loan_id}`}>
                              {lock.loan_id.slice(0, 8)}…
                            </Link>
                          </td>
                          <td className="px-3 py-2">{lock.product_name ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">
                            {lock.locked_rate != null ? `${Number(lock.locked_rate).toFixed(3)}%` : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs">{lock.lock_expiration ?? "—"}</td>
                          <td className="px-3 py-2 text-xs capitalize">{lock.status ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
