import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  usePricingCalculator,
  PricingDiagnostics,
  PricingResult,
  useSaveLoanPricingSnapshot,
  useRateLockActions,
} from "@/hooks/usePricing";
import { useLoan } from "@/hooks/useLoans";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { permissionKey } from "@/lib/permissions";
import { Loader2, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function PricingCalculatorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loanIdFromQuery = searchParams.get("loanId") ?? undefined;
  const bestExecFromQuery = searchParams.get("bestExecution") === "1";
  const { data: prefLoan } = useLoan(loanIdFromQuery);
  const { hasPermission } = useEffectivePermissions();
  const canSaveSnapshot = !!loanIdFromQuery && hasPermission(permissionKey("pricing", "calculate"));
  const canManageLocks = hasPermission(permissionKey("rate_locks", "manage"));
  const saveSnapshot = useSaveLoanPricingSnapshot();
  const lockActions = useRateLockActions();

  const [loanAmount, setLoanAmount] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [state, setState] = useState("");
  const [productType, setProductType] = useState<string | undefined>(undefined);
  const [lockTerm, setLockTerm] = useState<string | undefined>(undefined);
  const [occupancyType, setOccupancyType] = useState<string>("Primary");
  const [purpose, setPurpose] = useState<string>("Purchase");
  const [propertyType, setPropertyType] = useState<string>("sfr");
  const [investorCode, setInvestorCode] = useState("");
  const [bestExecution, setBestExecution] = useState(bestExecFromQuery);
  const [results, setResults] = useState<PricingResult[] | null>(null);
  const [diagnostics, setDiagnostics] = useState<PricingDiagnostics | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [lastRateSheetsConsidered, setLastRateSheetsConsidered] = useState<
    Array<{ id: string; name: string; investor_code?: string | null }> | undefined
  >(undefined);
  const [lastScenarioDims, setLastScenarioDims] = useState<Record<string, unknown> | undefined>(
    undefined,
  );

  const calculator = usePricingCalculator();

  useEffect(() => {
    if (bestExecFromQuery) setBestExecution(true);
  }, [bestExecFromQuery]);

  useEffect(() => {
    if (!prefLoan) return;
    if (prefLoan.loan_amount != null) setLoanAmount(String(prefLoan.loan_amount));
    if (prefLoan.appraised_value != null) setPropertyValue(String(prefLoan.appraised_value));
    if (prefLoan.credit_score != null) setCreditScore(String(prefLoan.credit_score));
    if (prefLoan.property_state) setState(String(prefLoan.property_state).slice(0, 2).toUpperCase());
    if (prefLoan.occupancy_type) setOccupancyType(String(prefLoan.occupancy_type));
    if (prefLoan.purpose) setPurpose(String(prefLoan.purpose));
  }, [prefLoan]);

  const persistSnapshot = async (res: PricingResult[], diag: PricingDiagnostics | null, sheets?: typeof lastRateSheetsConsidered) => {
    if (!loanIdFromQuery || !canSaveSnapshot) return;
    try {
      await saveSnapshot.mutateAsync({
        loanId: loanIdFromQuery,
        bestExecution: bestExecution,
        results: res,
        scenario_dims: lastScenarioDims,
        diagnostics: diag,
        rateSheetsConsidered: sheets,
      });
      toast.success("Snapshot saved to loan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save snapshot");
    }
  };

  const requestLockFromResult = async (r: PricingResult) => {
    if (!loanIdFromQuery || !canManageLocks) return;
    const term = lockTerm ? Number(lockTerm) : 30;
    try {
      await lockActions.mutateAsync({
        action: "create",
        loan_id: loanIdFromQuery,
        product_name: r.product_name,
        locked_rate: r.adjusted_rate,
        lock_term_days: term,
        rate_sheet_id: r.rate_sheet_id || null,
        investor_code: r.investor_code ?? null,
        price_at_lock: r.adjusted_price ?? null,
        source: "pricing_quote",
      });
      toast.success("Lock created and loan dates updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lock request failed");
    }
  };

  const handleCalculate = async () => {
    const amt = Number(loanAmount);
    const val = propertyValue ? Number(propertyValue) : undefined;
    const fico = Number(creditScore);
    setRunMessage(null);
    setDiagnostics(null);

    if (!amt || amt <= 0) {
      toast.error("Loan Amount must be greater than 0");
      return;
    }
    if (!fico || fico <= 0) {
      toast.error("Credit Score must be provided");
      return;
    }
    if (!state.trim()) {
      toast.error("State is required");
      return;
    }

    const payload: {
      loan_amount: number;
      property_value?: number;
      credit_score: number;
      state: string;
      product_type?: string;
      include_ineligible: boolean;
      lock_term_days?: number;
      occupancy_type?: string | null;
      purpose?: string | null;
      property_type?: string | null;
      investor_code?: string | null;
      best_execution?: boolean;
      loan_id?: string;
    } = {
      loan_amount: amt,
      property_value: val,
      credit_score: fico,
      state: state.trim(),
      product_type: productType,
      include_ineligible: true,
      occupancy_type: occupancyType || null,
      purpose: purpose || null,
      property_type: propertyType || null,
      best_execution: bestExecution,
    };
    if (lockTerm) payload.lock_term_days = Number(lockTerm);
    if (investorCode.trim()) payload.investor_code = investorCode.trim();
    if (loanIdFromQuery) payload.loan_id = loanIdFromQuery;

    try {
      const data = await calculator.mutateAsync(payload);
      setResults(data.results ?? []);
      setDiagnostics(data.diagnostics ?? null);
      setRunMessage(data.message ?? null);
      setLastRateSheetsConsidered(data.rate_sheets_considered);
      setLastScenarioDims(data.scenario_dims ?? undefined);

      if ((data.results ?? []).length === 0) {
        toast.message("No matching products found for this scenario.");
      } else {
        toast.success(`Calculated ${(data.results ?? []).length} pricing option(s).`);
      }
    } catch (err: unknown) {
      console.error(err);
      setResults([]);
      setDiagnostics(null);
      const message = err instanceof Error
        ? err.message
        : "Pricing calculation failed. Please verify rate sheet setup and try again.";
      setRunMessage(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pricing Calculator</h1>
          <p className="text-sm text-muted-foreground">
            Quote pricing, check eligibility, and explore what-if lock term scenarios.
          </p>
          {loanIdFromQuery && (
            <p className="text-xs mt-2 text-muted-foreground">
              Loan context:{" "}
              <Link className="text-primary underline" to={`/loans/${loanIdFromQuery}`}>
                {prefLoan?.loan_number ?? loanIdFromQuery}
              </Link>
              {canSaveSnapshot && results && results.length > 0 ? (
                <>
                  {" · "}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    disabled={saveSnapshot.isPending}
                    onClick={() => void persistSnapshot(results, diagnostics, lastRateSheetsConsidered)}
                  >
                    Save snapshot to loan
                  </Button>
                </>
              ) : null}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Enter scenario details to calculate pricing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="number"
              placeholder="Loan Amount"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Property Value"
              value={propertyValue}
              onChange={(e) => setPropertyValue(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Credit Score"
              value={creditScore}
              onChange={(e) => setCreditScore(e.target.value)}
            />
            <Input
              placeholder="State (e.g. CA)"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
            />
            <SearchableSelect
              value={productType ?? ""}
              onChange={(v) => setProductType(v || undefined)}
              placeholder="Product Type (optional)"
              options={[
                { value: "CONVENTIONAL", label: "Conventional" },
                { value: "FHA", label: "FHA" },
                { value: "VA", label: "VA" },
                { value: "JUMBO", label: "Jumbo" },
              ]}
            />
            <SearchableSelect
              value={occupancyType}
              onChange={(v) => setOccupancyType(v || "Primary")}
              placeholder="Occupancy"
              options={[
                { value: "Primary", label: "Primary" },
                { value: "SecondHome", label: "Second home" },
                { value: "Investment", label: "Investment" },
              ]}
            />
            <SearchableSelect
              value={purpose}
              onChange={(v) => setPurpose(v || "Purchase")}
              placeholder="Purpose"
              options={[
                { value: "Purchase", label: "Purchase" },
                { value: "Refinance", label: "Rate/term refinance" },
                { value: "CashOutRefinance", label: "Cash-out refinance" },
              ]}
            />
            <SearchableSelect
              value={propertyType}
              onChange={(v) => setPropertyType(v || "sfr")}
              placeholder="Property type"
              options={[
                { value: "sfr", label: "Single-family" },
                { value: "condo", label: "Condo" },
                { value: "two_to_four_unit", label: "2–4 units" },
              ]}
            />
            <Input
              placeholder="Investor code (optional, e.g. INVESTOR_A)"
              value={investorCode}
              onChange={(e) => setInvestorCode(e.target.value)}
            />
            <div className="flex items-center space-x-2">
              <Checkbox
                id="best-ex"
                checked={bestExecution}
                onCheckedChange={(c) => setBestExecution(!!c)}
              />
              <Label htmlFor="best-ex" className="text-sm font-normal cursor-pointer">
                Best execution across all active rate sheets
              </Label>
            </div>
            <SearchableSelect
              value={lockTerm ?? ""}
              onChange={(v) => setLockTerm(v || undefined)}
              placeholder="Lock Term (optional)"
              options={[
                { value: "30", label: "30 days" },
                { value: "45", label: "45 days" },
                { value: "60", label: "60 days" },
              ]}
            />
            <Button onClick={handleCalculate} disabled={calculator.isLoading}>
              {calculator.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Calculate Pricing
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Eligible products, pricing, and lock term simulations.</CardDescription>
          </CardHeader>
          <CardContent>
            {diagnostics && (
              <div className="mb-3 rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
                <div className="font-medium">Run Details</div>
                <div className="text-muted-foreground mt-1">
                  Sheet: {diagnostics.active_rate_sheet_name} • State used: {diagnostics.normalized_state}
                </div>
                <div className="text-muted-foreground">
                  Products:{" "}
                  {diagnostics.total_products_in_sheet ?? diagnostics.total_products_considered ?? "—"}{" "}
                  • Returned: {diagnostics.considered_products} • Eligible:{" "}
                  {diagnostics.eligible_products}
                  {diagnostics.best_execution ? " • Best execution" : ""}
                </div>
              </div>
            )}
            {calculator.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !results || results.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {runMessage || "No results yet. Enter inputs and run the calculator."}
                </p>
                {runMessage && (
                  <p className="text-xs text-muted-foreground">
                    Tip: use a 2-letter state code (e.g. NY, CA) and realistic FICO values.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((r, idx) => (
                  <div
                    key={`${r.product_name}-${idx}`}
                    className="rounded-md border border-border/60 p-3 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{r.product_name}</div>
                      <div className="text-xs text-muted-foreground text-right">
                        {r.loan_type || "N/A"} • {r.state}
                        {r.investor_code ? ` • ${r.investor_code}` : ""}
                        {r.quote_type ? ` • ${r.quote_type}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div>
                        <span className="font-semibold">Rate:</span>{" "}
                        {r.adjusted_rate.toFixed(3)}%
                      </div>
                      <div>
                        <span className="font-semibold">Price:</span>{" "}
                        {r.adjusted_price != null ? r.adjusted_price.toFixed(3) : "—"}
                      </div>
                      <div>
                        <span className="font-semibold">Eligibility:</span>{" "}
                        <span
                          className={
                            r.eligibility_status === "Eligible"
                              ? "text-emerald-600"
                              : r.eligibility_status === "EligibleWithConditions"
                                ? "text-amber-600"
                                : "text-rose-600"
                          }
                        >
                          {r.eligibility_status}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.eligibility_message}
                    </div>
                    {r.simulations && r.simulations.length > 0 && (
                      <div className="mt-2 text-xs">
                        <div className="font-semibold mb-1">What-if Lock Terms:</div>
                        <div className="flex flex-wrap gap-2">
                          {r.simulations.map((sim) => (
                            <div
                              key={sim.lock_term_days}
                              className="rounded border px-2 py-1"
                            >
                              <div>{sim.lock_term_days} days</div>
                              <div>Rate {sim.est_rate.toFixed(3)}%</div>
                              <div>
                                Price{" "}
                                {sim.est_price != null ? sim.est_price.toFixed(3) : "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {loanIdFromQuery &&
                      canManageLocks &&
                      r.quote_type === "lock_eligible" &&
                      r.eligibility_status !== "Not Eligible" && (
                        <div className="mt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="gap-1"
                            disabled={lockActions.isPending}
                            onClick={() => void requestLockFromResult(r)}
                          >
                            <Lock className="h-3 w-3" />
                            Request lock (manual)
                          </Button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

