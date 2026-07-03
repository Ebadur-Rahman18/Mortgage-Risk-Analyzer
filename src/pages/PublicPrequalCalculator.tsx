import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PrequalCalculatorCore } from "@/components/mortgage/PrequalCalculatorCore";

export default function PublicPrequalCalculator() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pre-qualification calculator</h1>
            <p className="text-sm text-muted-foreground">
              Public self-serve estimate. This does not guarantee approval or final loan terms.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/login">Staff sign in</Link>
          </Button>
        </div>
        <PrequalCalculatorCore mode="public" />
      </div>
    </div>
  );
}
