import { PrequalCalculatorCore } from "@/components/mortgage/PrequalCalculatorCore";
import { Badge } from "@/components/ui/badge";

export default function PrequalCalculator() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pre-qual / pre-approval calculator</h1>
        <p className="text-sm text-muted-foreground">
          Internal calculator for fast borrower qualification triage and handoff to underwriting/pricing.
        </p>
        <Badge variant="secondary" className="mt-2">
          Internal-only (requires pricing:calculate)
        </Badge>
      </div>
      <PrequalCalculatorCore mode="internal" />
    </div>
  );
}
