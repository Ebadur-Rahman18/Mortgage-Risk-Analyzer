import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { monthlyPrincipalAndInterest, safeNumber } from "@/lib/mortgageMath";

interface Props {
  mode: "internal" | "public";
}

export function PrequalCalculatorCore({ mode }: Props) {
  const [annualIncome, setAnnualIncome] = useState("120000");
  const [monthlyDebt, setMonthlyDebt] = useState("1200");
  const [creditScore, setCreditScore] = useState("720");
  const [homePrice, setHomePrice] = useState("450000");
  const [downPaymentPct, setDownPaymentPct] = useState("10");
  const [interestRate, setInterestRate] = useState("6.50");
  const [termYears, setTermYears] = useState("30");
  const [includeTaxesInsurance, setIncludeTaxesInsurance] = useState(true);
  const [taxInsuranceMonthly, setTaxInsuranceMonthly] = useState("650");

  const metrics = useMemo(() => {
    const incomeMonthly = safeNumber(annualIncome) / 12;
    const debts = safeNumber(monthlyDebt);
    const fico = safeNumber(creditScore);
    const price = safeNumber(homePrice);
    const dpPct = safeNumber(downPaymentPct);
    const rate = safeNumber(interestRate);
    const years = safeNumber(termYears, 30);

    const downPayment = price * (dpPct / 100);
    const loanAmount = Math.max(0, price - downPayment);
    const pi = monthlyPrincipalAndInterest({ loanAmount, annualRatePct: rate, termYears: years });
    const ti = includeTaxesInsurance ? safeNumber(taxInsuranceMonthly) : 0;
    const proposedHousing = pi + ti;
    const dti = incomeMonthly > 0 ? ((debts + proposedHousing) / incomeMonthly) * 100 : 0;
    const ltv = price > 0 ? (loanAmount / price) * 100 : 0;

    let status: "pass" | "review" | "not_eligible" = "pass";
    if (fico < 620 || dti > 50 || ltv > 97) status = "not_eligible";
    else if (fico < 680 || dti > 43 || ltv > 95) status = "review";

    return {
      loanAmount,
      downPayment,
      pi,
      ti,
      proposedHousing,
      dti,
      ltv,
      fico,
      status,
    };
  }, [
    annualIncome,
    monthlyDebt,
    creditScore,
    homePrice,
    downPaymentPct,
    interestRate,
    termYears,
    includeTaxesInsurance,
    taxInsuranceMonthly,
  ]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Borrower scenario</CardTitle>
          <CardDescription>
            Quick, indicative pre-qualification estimate. Not a credit decision.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Annual income">
            <Input type="number" value={annualIncome} onChange={(e) => setAnnualIncome(e.target.value)} />
          </Field>
          <Field label="Monthly debts">
            <Input type="number" value={monthlyDebt} onChange={(e) => setMonthlyDebt(e.target.value)} />
          </Field>
          <Field label="Credit score">
            <Input type="number" value={creditScore} onChange={(e) => setCreditScore(e.target.value)} />
          </Field>
          <Field label="Home price target">
            <Input type="number" value={homePrice} onChange={(e) => setHomePrice(e.target.value)} />
          </Field>
          <Field label="Down payment %">
            <Input type="number" value={downPaymentPct} onChange={(e) => setDownPaymentPct(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate %">
              <Input type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            </Field>
            <Field label="Term years">
              <Input type="number" value={termYears} onChange={(e) => setTermYears(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded border p-2">
            <Label htmlFor="include-ti" className="text-sm">
              Include taxes/insurance
            </Label>
            <Switch id="include-ti" checked={includeTaxesInsurance} onCheckedChange={setIncludeTaxesInsurance} />
          </div>
          {includeTaxesInsurance && (
            <Field label="Taxes + insurance monthly">
              <Input
                type="number"
                value={taxInsuranceMonthly}
                onChange={(e) => setTaxInsuranceMonthly(e.target.value)}
              />
            </Field>
          )}
          {mode === "internal" ? (
            <div className="flex gap-2">
              <Button type="button" variant="secondary">Save scenario</Button>
              <Button type="button">Create loan from scenario</Button>
            </div>
          ) : (
            <Button type="button">Request pre-approval follow-up</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pre-qual result</CardTitle>
          <CardDescription>Rule-of-thumb checks for internal triage and borrower guidance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Result label="Estimated loan amount" value={money(metrics.loanAmount)} />
          <Result label="Down payment" value={money(metrics.downPayment)} />
          <Result label="P&I monthly" value={money(metrics.pi)} />
          <Result label="Total housing monthly" value={money(metrics.proposedHousing)} />
          <Result label="DTI" value={`${metrics.dti.toFixed(2)}%`} />
          <Result label="LTV" value={`${metrics.ltv.toFixed(2)}%`} />
          <Result label="Credit score" value={String(metrics.fico)} />

          {metrics.status === "pass" && (
            <Alert>
              <AlertTitle>Pre-qual pass</AlertTitle>
              <AlertDescription>Scenario is within baseline thresholds.</AlertDescription>
            </Alert>
          )}
          {metrics.status === "review" && (
            <Alert>
              <AlertTitle>Manual review</AlertTitle>
              <AlertDescription>Borderline DTI/LTV/FICO. Underwriter review recommended.</AlertDescription>
            </Alert>
          )}
          {metrics.status === "not_eligible" && (
            <Alert variant="destructive">
              <AlertTitle>Not eligible (baseline)</AlertTitle>
              <AlertDescription>One or more limits exceeded for this quick pre-qual profile.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border p-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
