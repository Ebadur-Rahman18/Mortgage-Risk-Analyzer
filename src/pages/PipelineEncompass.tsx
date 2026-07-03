// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Link2, RefreshCcw } from "lucide-react";
import { useIntegrationSetting } from "@/hooks/useIntegrationSettings";
import { useSyncDataFeed } from "@/hooks/useSyncDataFeed";
import { LOANS_PAGE_SIZE, useLoansBySource } from "@/hooks/useLoans";
import { useEffect, useMemo, useState } from "react";

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "ellipsis", total];
  if (current >= total - 2) return [1, "ellipsis", total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export default function PipelineEncompass() {
  const { data: encompassIntegration } = useIntegrationSetting("encompass");
  const encompassSync = useSyncDataFeed("encompass");
  const [page, setPage] = useState(1);
  const { data: loansData, isLoading: loansLoading } = useLoansBySource("encompass", { page });

  const encompassReady = Boolean(
    encompassIntegration?.is_active &&
      (encompassIntegration.api_key || encompassIntegration.api_key_masked),
  );
  const encompassCfg = (encompassIntegration?.config ?? {}) as Record<string, string>;
  const lastSyncAt = encompassCfg.last_sync_at || null;
  const loans = loansData?.rows ?? [];
  const totalCount = loansData?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / LOANS_PAGE_SIZE));
  const showingStart = totalCount === 0 ? 0 : (page - 1) * LOANS_PAGE_SIZE + 1;
  const showingEnd = Math.min(page * LOANS_PAGE_SIZE, totalCount);
  const lastSyncText = useMemo(
    () => (lastSyncAt ? new Date(lastSyncAt).toLocaleString() : null),
    [lastSyncAt],
  );

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pipeline - Encompass</CardTitle>
          <CardDescription>
            Sync Encompass LOS data from this page. Data is refreshed when you run sync here or from Admin →
            Integrations. Sections in this page: Encompass Sync Controls and Encompass Synced Loans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="default"
            onClick={() => encompassSync.mutate()}
            disabled={encompassSync.isPending || !encompassReady}
            title={!encompassReady ? "Configure Encompass in Admin → Integrations" : undefined}
          >
            {encompassSync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Sync from Encompass
          </Button>

          {!encompassReady && (
            <Alert className="py-2">
              <Link2 className="h-4 w-4" />
              <AlertDescription>
                Encompass must be configured and enabled in Admin → Integrations before sync can run.
              </AlertDescription>
            </Alert>
          )}

          {lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              Last Encompass sync:{" "}
              <span className="font-medium text-foreground">{lastSyncText}</span>
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            Synced loan records are available in the Loans workspace after import.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Encompass synced loans</CardTitle>
          <CardDescription>
            Loans imported from Encompass (`data_source = encompass`) with server-side pagination.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loansLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading synced loans...
            </div>
          ) : loans.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <p className="text-sm">No Encompass loans synced yet.</p>
              {encompassReady && <p className="text-xs">Press &quot;Sync from Encompass&quot; to load loans.</p>}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan #</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Loan amount</TableHead>
                      <TableHead>Last updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => {
                      const borrower = Array.isArray(loan.borrowers) ? loan.borrowers[0] : loan.borrowers;
                      const borrowerName = [borrower?.first_name, borrower?.last_name].filter(Boolean).join(" ") || "—";
                      return (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium">{loan.loan_number || "—"}</TableCell>
                          <TableCell>{borrowerName}</TableCell>
                          <TableCell>{loan.status || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {loan.loan_amount != null
                              ? new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                }).format(Number(loan.loan_amount))
                              : "—"}
                          </TableCell>
                          <TableCell>{new Date(loan.updated_at).toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {showingStart}–{showingEnd} of {totalCount}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-disabled={page === 1}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {buildPageNumbers(page, totalPages).map((p, idx) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`e-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          aria-disabled={page === totalPages}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
