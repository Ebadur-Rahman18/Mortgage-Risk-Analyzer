import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign } from "lucide-react";
import {
  useCalculateClosingCosts,
  useLoanFeeEstimates,
} from "@/hooks/usePhase3LoanTools";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { permissionKey } from "@/lib/permissions";

interface Props {
  loanId: string;
  loanAmount: number | null;
}

export function LoanClosingCostsCard({ loanId, loanAmount }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const canPrice = hasPermission(permissionKey("pricing", "calculate"));
  const calc = useCalculateClosingCosts();
  const { data: history = [], isLoading } = useLoanFeeEstimates(loanId);

  const run = async (persist: boolean) => {
    const amt = Number(loanAmount ?? 0);
    if (!amt) return;
    await calc.mutateAsync({
      loan_id: loanId,
      loan_amount: amt,
      estimate_type: "ILLUSTRATIVE",
      persist: persist && canPrice,
    });
  };

  const latest = history[0] as
    | { lines?: unknown[]; total_borrower?: number; disclaimer?: string; created_at?: string }
    | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Closing cost estimate
        </CardTitle>
        <CardDescription>
          Illustrative fees from the active template — not a regulatory LE/CD.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!loanAmount || calc.isPending}
            onClick={() => void run(false)}
          >
            {calc.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Preview
          </Button>
          {canPrice && (
            <Button
              type="button"
              size="sm"
              disabled={!loanAmount || calc.isPending}
              onClick={() => void run(true)}
            >
              Save to loan
            </Button>
          )}
        </div>

        {calc.data && (
          <div className="rounded-md border p-3 text-sm space-y-2">
            <p className="font-medium">
              Total (borrower):{" "}
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                calc.data.total_borrower ?? 0,
              )}
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
              {(calc.data.lines ?? []).map((line) => {
                const l = line as { label?: string; amount?: number };
                return (
                  <li key={String(l.label)} className="flex justify-between gap-2">
                    <span>{l.label}</span>
                    <span>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                        Number(l.amount ?? 0),
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[10px] text-muted-foreground">{calc.data.disclaimer}</p>
          </div>
        )}

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : latest ? (
          <div className="text-xs text-muted-foreground">
            Last saved:{" "}
            {latest.total_borrower != null
              ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                  Number(latest.total_borrower),
                )
              : "—"}{" "}
            · {latest.created_at ? new Date(latest.created_at).toLocaleString() : ""}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
