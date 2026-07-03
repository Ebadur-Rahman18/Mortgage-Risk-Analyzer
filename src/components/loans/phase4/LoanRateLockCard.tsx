import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useRateLocksByLoan,
  useRateLockActions,
  useLoanPricingSnapshot,
  pickWinnerPricingResult,
  type PricingResult,
} from "@/hooks/usePricing";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { permissionKey } from "@/lib/permissions";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

const ACTIVEISH = new Set(["active", "extended", "relocked"]);

interface Props {
  loanId: string;
}

export function LoanRateLockCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const canRead = hasPermission(permissionKey("rate_locks", "read"));
  const canManage = hasPermission(permissionKey("rate_locks", "manage"));
  const { data, isLoading } = useRateLocksByLoan(loanId);
  const { data: snapshot } = useLoanPricingSnapshot(loanId);
  const actions = useRateLockActions();

  const [product, setProduct] = useState("");
  const [rate, setRate] = useState("");
  const [termDays, setTermDays] = useState("30");
  const [extendDays, setExtendDays] = useState("15");

  const locks = (data?.locks ?? []) as Record<string, unknown>[];
  const activeLock = useMemo(
    () =>
      locks.find((l) => ACTIVEISH.has(String(l.status ?? "").toLowerCase())) as
        | { id?: string; product_name?: string; locked_rate?: number; status?: string }
        | undefined,
    [locks],
  );

  const applyFromSnapshot = () => {
    const raw = snapshot?.raw_summary as Record<string, unknown> | null | undefined;
    const lr = raw?.last_results;
    const fromRaw = Array.isArray(lr) ? (lr as PricingResult[]) : undefined;
    let winner: PricingResult | null = null;
    if (fromRaw?.length) {
      winner = pickWinnerPricingResult(fromRaw);
    } else if (
      snapshot?.winner_product_name &&
      snapshot.winner_rate != null
    ) {
      winner = {
        rate_sheet_id: "",
        product_name: snapshot.winner_product_name,
        loan_type: null,
        state: "",
        base_rate: Number(snapshot.winner_rate),
        base_price: snapshot.winner_price,
        adjusted_rate: Number(snapshot.winner_rate),
        adjusted_price: snapshot.winner_price,
        eligibility_status: "Eligible",
        eligibility_message: "",
        investor_code: snapshot.winner_investor_code,
        quote_type: snapshot.winner_quote_type ?? undefined,
        simulations: [],
      };
    }
    if (!winner) {
      toast.message("No pricing snapshot to apply. Save a snapshot from the calculator first.");
      return;
    }
    setProduct(winner.product_name);
    setRate(String(winner.adjusted_rate));
    const sim30 = winner.simulations?.find((s) => s.lock_term_days === 30);
    if (sim30) setTermDays("30");
    toast.success("Form filled from last snapshot.");
  };

  const createLock = async () => {
    const r = Number(rate);
    const t = Number(termDays);
    if (!product.trim() || !r || !t) {
      toast.error("Product, rate, and lock term are required.");
      return;
    }
    try {
      await actions.mutateAsync({
        action: "create",
        loan_id: loanId,
        product_name: product.trim(),
        locked_rate: r,
        lock_term_days: t,
        investor_code: snapshot?.winner_investor_code ?? null,
        price_at_lock: snapshot?.winner_price != null ? Number(snapshot.winner_price) : null,
        rate_sheet_id: null,
        source: snapshot ? "pricing_quote" : "manual",
      });
      toast.success("Rate lock created.");
      setProduct("");
      setRate("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create lock");
    }
  };

  const extendLock = async () => {
    if (!activeLock?.id) return;
    const d = Number(extendDays);
    if (!d) {
      toast.error("Enter extension days.");
      return;
    }
    try {
      await actions.mutateAsync({
        action: "extend",
        rate_lock_id: activeLock.id,
        extension_days: d,
      });
      toast.success("Lock extended.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extend failed");
    }
  };

  const relock = async () => {
    if (!activeLock?.id) return;
    const r = Number(rate);
    const t = Number(termDays);
    if (!product.trim() || !r || !t) {
      toast.error("Product, rate, and lock term are required for relock.");
      return;
    }
    try {
      await actions.mutateAsync({
        action: "relock",
        rate_lock_id: activeLock.id,
        product_name: product.trim(),
        locked_rate: r,
        lock_term_days: t,
      });
      toast.success("Relock completed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Relock failed");
    }
  };

  if (!canRead) return null;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" />
          Rate lock
        </CardTitle>
        <CardDescription>
          Manual lock workflow. New locks sync loan lock dates for dashboards and alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="overflow-x-auto text-sm rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Expiration</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {locks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                      No rate locks on file.
                    </td>
                  </tr>
                ) : (
                  locks.map((lock) => (
                    <tr key={String(lock.id)} className="border-b last:border-0">
                      <td className="px-3 py-2">{String(lock.product_name ?? "—")}</td>
                      <td className="px-3 py-2">
                        {lock.locked_rate != null ? `${Number(lock.locked_rate).toFixed(3)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{String(lock.lock_expiration ?? "—")}</td>
                      <td className="px-3 py-2 text-xs capitalize">{String(lock.status ?? "")}</td>
                      <td className="px-3 py-2 text-xs">{String(lock.source ?? "—")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {canManage && (
          <div className="space-y-4 rounded-md border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => applyFromSnapshot()}>
                Fill from last pricing snapshot
              </Button>
              {activeLock?.id ? (
                <span className="text-xs text-muted-foreground">
                  Active row: {activeLock.status} — use extend or relock below.
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor={`rl-prod-${loanId}`}>Product name</Label>
                <Input
                  id={`rl-prod-${loanId}`}
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="e.g. 30-year fixed"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`rl-rate-${loanId}`}>Locked rate (%)</Label>
                <Input
                  id={`rl-rate-${loanId}`}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="6.375"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`rl-term-${loanId}`}>Lock term (days)</Label>
                <Input
                  id={`rl-term-${loanId}`}
                  value={termDays}
                  onChange={(e) => setTermDays(e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void createLock()} disabled={actions.isPending}>
                {actions.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Create lock
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  className="w-20 h-9"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  aria-label="Extension days"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!activeLock?.id || actions.isPending}
                  onClick={() => void extendLock()}
                >
                  Extend
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!activeLock?.id || actions.isPending}
                  onClick={() => void relock()}
                >
                  Relock
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
