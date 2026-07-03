import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { monthlyPrincipalAndInterest, safeNumber } from "@/lib/mortgageMath";

export function MortgageCalculatorWidgetCore() {
  const [homePrice, setHomePrice] = useState("450000");
  const [downPaymentPct, setDownPaymentPct] = useState("10");
  const [interestRate, setInterestRate] = useState("6.50");
  const [termYears, setTermYears] = useState("30");
  const [taxesMonthly, setTaxesMonthly] = useState("375");
  const [insuranceMonthly, setInsuranceMonthly] = useState("175");
  const [hoaMonthly, setHoaMonthly] = useState("0");

  const summary = useMemo(() => {
    const price = safeNumber(homePrice);
    const dpPct = safeNumber(downPaymentPct);
    const rate = safeNumber(interestRate);
    const years = safeNumber(termYears, 30);
    const downPayment = price * (dpPct / 100);
    const loanAmount = Math.max(0, price - downPayment);
    const pi = monthlyPrincipalAndInterest({ loanAmount, annualRatePct: rate, termYears: years });
    const escrow = safeNumber(taxesMonthly) + safeNumber(insuranceMonthly) + safeNumber(hoaMonthly);
    return { loanAmount, downPayment, pi, escrow, total: pi + escrow };
  }, [homePrice, downPaymentPct, interestRate, termYears, taxesMonthly, insuranceMonthly, hoaMonthly]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mortgage calculator</CardTitle>
          <CardDescription>Public estimate widget for web or iframe embed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Home price"><Input type="number" value={homePrice} onChange={(e) => setHomePrice(e.target.value)} /></Field>
          <Field label="Down payment %"><Input type="number" value={downPaymentPct} onChange={(e) => setDownPaymentPct(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate %"><Input type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} /></Field>
            <Field label="Term years"><Input type="number" value={termYears} onChange={(e) => setTermYears(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Taxes"><Input type="number" value={taxesMonthly} onChange={(e) => setTaxesMonthly(e.target.value)} /></Field>
            <Field label="Insurance"><Input type="number" value={insuranceMonthly} onChange={(e) => setInsuranceMonthly(e.target.value)} /></Field>
            <Field label="HOA"><Input type="number" value={hoaMonthly} onChange={(e) => setHoaMonthly(e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly payment estimate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Estimated loan amount" value={money(summary.loanAmount)} />
          <Row label="Principal & interest" value={money(summary.pi)} />
          <Row label="Taxes/insurance/HOA" value={money(summary.escrow)} />
          <Row label="Estimated total monthly" value={money(summary.total)} strong />
          <p className="text-xs text-muted-foreground pt-2">
            Estimate only. Taxes, insurance, PMI, and final terms vary by loan program and underwriting.
          </p>
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

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border p-2">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
