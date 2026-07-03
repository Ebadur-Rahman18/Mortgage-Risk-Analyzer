import { MortgageCalculatorWidgetCore } from "@/components/mortgage/MortgageCalculatorWidgetCore";

export default function MortgageCalculatorWidget() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-8 space-y-4">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Mortgage calculator widget</h1>
        <MortgageCalculatorWidgetCore />
      </div>
    </div>
  );
}
