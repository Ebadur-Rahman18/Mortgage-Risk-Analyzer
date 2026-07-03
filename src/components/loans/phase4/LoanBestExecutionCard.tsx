import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLoanPricingSnapshot } from "@/hooks/usePricing";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { permissionKey } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Gauge, Loader2 } from "lucide-react";

interface Props {
  loanId: string;
}

export function LoanBestExecutionCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const canPrice = hasPermission(permissionKey("pricing", "calculate"));
  const { data: snap, isLoading } = useLoanPricingSnapshot(loanId);

  if (!canPrice) return null;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" />
          Best execution snapshot
        </CardTitle>
        <CardDescription>
          Last saved pricing run on this loan (from calculator or quick pricer). Run pricing with best
          execution to refresh.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !snap ? (
          <p className="text-sm text-muted-foreground">
            No snapshot yet. Run pricing and choose &quot;Save snapshot to loan&quot; to record best pricing
            here.
          </p>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Computed:</span>{" "}
                <span className="font-medium">{formatDate(snap.computed_at)}</span>
                {snap.best_execution ? (
                  <span className="ml-2 text-xs rounded border px-1.5 py-0">Best execution</span>
                ) : null}
              </div>
              <div>
                <span className="text-muted-foreground">Winner:</span>{" "}
                <span className="font-medium">
                  {snap.winner_investor_code ?? "—"}
                  {snap.winner_product_name ? ` · ${snap.winner_product_name}` : ""}
                </span>
              </div>
              <div className="text-muted-foreground">
                Rate {snap.winner_rate != null ? `${Number(snap.winner_rate).toFixed(3)}%` : "—"} · Price{" "}
                {snap.winner_price != null ? Number(snap.winner_price).toFixed(3) : "—"}
                {snap.winner_quote_type ? ` · ${snap.winner_quote_type}` : ""}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Pricing module is currently disabled.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
