import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileRiskAgent, type LoanRiskResult } from "@/hooks/useFileRiskAgent";
import type { Loan } from "@/hooks/useLoans";

interface FileRiskAgentQuickButtonProps {
  loan: Loan;
}

const QUICK_RISK_STYLES: Record<
  LoanRiskResult["risk_level"],
  { label: string; className: string }
> = {
  low: { label: "Low", className: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" },
  medium: { label: "Medium", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" },
  high: { label: "High", className: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300" },
  critical: { label: "Critical", className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" },
};

function QuickRiskResultCard({ result }: { result: LoanRiskResult }) {
  const s = QUICK_RISK_STYLES[result.risk_level] ?? QUICK_RISK_STYLES.medium;
  const topFactors = result.risk_factors?.slice(0, 4) ?? [];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">Loan #{result.loan_number}</p>
          {result.borrower_name ? (
            <p className="text-xs text-muted-foreground truncate">{result.borrower_name}</p>
          ) : null}
        </div>
        <Badge className={cn("shrink-0", s.className)}>{s.label}</Badge>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">Score: {result.overall_risk_score}/100</span>
        <span className="font-mono">Lock: {result.lock_expiry_risk}</span>
        <span className="font-mono">Stall: {result.stall_risk}</span>
      </div>

      {topFactors.length > 0 ? (
        <div className="space-y-1">
          {topFactors.map((f, i) => (
            <p key={i} className="text-xs">
              • <span className="font-medium">[{f.type}]</span> {f.description}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No risk factors returned.</p>
      )}
    </div>
  );
}

export function FileRiskAgentQuickButton({ loan }: FileRiskAgentQuickButtonProps) {
  const [open, setOpen] = useState(false);
  const { mutate: runAnalysis, isPending, data } = useFileRiskAgent();

  function handleAnalyze() {
    runAnalysis({ loanIds: [loan.id] }, {
      onSuccess: () => setOpen(true),
    });
  }

  const result = data?.results?.find((r) => r.loan_id === loan.id);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleAnalyze}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <BrainCircuit className="h-4 w-4" />
        )}
        Quick risk analysis
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5" />
              Risk Analysis — Loan #{loan.loan_number}
            </DialogTitle>
            <DialogDescription>
              Rule-based pipeline analysis for this loan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {result ? (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(data!.analyzed_at).toLocaleTimeString()}
                </div>
                <QuickRiskResultCard result={result} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No result yet. Run the analysis first.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
