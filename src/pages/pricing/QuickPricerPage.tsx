import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  usePricingCalculator,
  useSaveLoanPricingSnapshot,
  useRateLockActions,
  type PricingResult,
} from "@/hooks/usePricing";
import { useLoan } from "@/hooks/useLoans";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { permissionKey } from "@/lib/permissions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, Lock } from "lucide-react";
import { toast } from "sonner";

export default function QuickPricerPage() {
  const [searchParams] = useSearchParams();
  const loanId = searchParams.get("loanId") ?? undefined;
  const { data: loan } = useLoan(loanId);
  const { hasPermission } = useEffectivePermissions();
  const saveSnapshot = useSaveLoanPricingSnapshot();
  const lockActions = useRateLockActions();
  const canSaveSnapshot = !!loanId && hasPermission(permissionKey("pricing", "calculate"));
  const canManageLocks = hasPermission(permissionKey("rate_locks", "manage"));

  const [loanAmount, setLoanAmount] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [state, setState] = useState("");
  const [results, setResults] = useState<PricingResult[] | null>(null);
  const [bestExecution, setBestExecution] = useState(false);
  const calculator = usePricingCalculator();

  useEffect(() => {
    if (!loan) return;
    if (loan.loan_amount != null) setLoanAmount(String(loan.loan_amount));
    if (loan.appraised_value != null) setPropertyValue(String(loan.appraised_value));
    if (loan.credit_score != null) setCreditScore(String(loan.credit_score));
    if (loan.property_state) setState(String(loan.property_state).slice(0, 2).toUpperCase());
  }, [loan]);

  const handleQuote = async () => {
    const amt = Number(loanAmount);
    const val = propertyValue ? Number(propertyValue) : undefined;
    const fico = Number(creditScore);
    if (!amt || amt <= 0) {
      toast.error("Loan amount required");
      return;
    }
    if (!fico || fico <= 0) {
      toast.error("Credit score required");
      return;
    }
    if (!state.trim()) {
      toast.error("State required");
      return;
    }

    try {
      const data = await calculator.mutateAsync({
        loan_amount: amt,
        property_value: val,
        credit_score: fico,
        state: state.trim(),
        loan_id: loanId,
        occupancy_type: loan?.occupancy_type ?? "Primary",
        purpose: loan?.purpose ?? "Purchase",
        property_type: "sfr",
        include_ineligible: false,
        lock_term_days: 30,
        best_execution: bestExecution,
      });
      setResults(data.results ?? []);
      toast.success(`Found ${(data.results ?? []).length} option(s)`);
      if (loanId && canSaveSnapshot && (data.results ?? []).length > 0) {
        try {
          await saveSnapshot.mutateAsync({
            loanId,
            bestExecution,
            results: data.results ?? [],
            scenario_dims: data.scenario_dims,
            diagnostics: data.diagnostics ?? null,
            rateSheetsConsidered: data.rate_sheets_considered,
          });
          toast.message("Pricing snapshot saved to loan.");
        } catch {
          /* non-fatal */
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Quick quote failed";
      toast.error(message);
      setResults([]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Quick Pricer
        </h1>
        <p className="text-sm text-muted-foreground">
          Minimal inputs for a fast indicative quote. Uses the same engine as the full calculator with
          sensible defaults (primary, purchase, SFR, 30-day lock, eligible products only).
        </p>
        {loanId && (
          <p className="text-xs mt-2">
            <Link className="text-primary underline" to={`/loans/${loanId}`}>
              Back to loan {loan?.loan_number ?? loanId}
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scenario</CardTitle>
            <CardDescription>Five fields — go.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="number"
              placeholder="Loan amount"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Property value (optional)"
              value={propertyValue}
              onChange={(e) => setPropertyValue(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Credit score"
              value={creditScore}
              onChange={(e) => setCreditScore(e.target.value)}
            />
            <Input
              placeholder="State (e.g. CA)"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              maxLength={2}
            />
            <div className="flex items-center space-x-2">
              <Checkbox
                id="qp-best-ex"
                checked={bestExecution}
                onCheckedChange={(c) => setBestExecution(!!c)}
              />
              <Label htmlFor="qp-best-ex" className="text-sm font-normal cursor-pointer">
                Best execution across active sheets
              </Label>
            </div>
                                <Button onClick={() => void handleQuote()} disabled={calculator.isPending}>
              {calculator.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get quote
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Best options</CardTitle>
            <CardDescription>Lowest rate among eligible products.</CardDescription>
          </CardHeader>
          <CardContent>
            {calculator.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : !results?.length ? (
              <p className="text-sm text-muted-foreground">Run a quote to see results.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {results.slice(0, 5).map((r, i) => (
                  <li key={i} className="rounded border p-2 flex flex-wrap justify-between gap-2 items-center">
                    <span className="font-medium">{r.product_name}</span>
                    <span>{r.adjusted_rate.toFixed(3)}%</span>
                    {loanId &&
                      canManageLocks &&
                      r.quote_type === "lock_eligible" &&
                      r.eligibility_status !== "Not Eligible" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1 shrink-0"
                          disabled={lockActions.isPending}
                          onClick={() =>
                            void lockActions
                              .mutateAsync({
                                action: "create",
                                loan_id: loanId,
                                product_name: r.product_name,
                                locked_rate: r.adjusted_rate,
                                lock_term_days: 30,
                                rate_sheet_id: r.rate_sheet_id || null,
                                investor_code: r.investor_code ?? null,
                                price_at_lock: r.adjusted_price ?? null,
                                source: "pricing_quote",
                              })
                              .then(() => toast.success("Lock created."))
                              .catch((e) => toast.error(e instanceof Error ? e.message : "Lock failed"))
                          }
                        >
                          <Lock className="h-3 w-3" />
                          Lock
                        </Button>
                      )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
