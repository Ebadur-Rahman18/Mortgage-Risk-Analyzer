import { useState } from "react";
import { useAvailableTransitions, useTransitionLoanStatus } from "@/hooks/useLoanTransitions";
import { useComplianceRuleRuns, useRunComplianceRules } from "@/hooks/usePhase3LoanTools";
import { STATUS_LABELS, isTerminalStatus } from "@/lib/loan-pipeline-stages";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowRight, Loader2 } from "lucide-react";

interface Props {
  loanId: string;
  currentStatus: string;
}

const STATUS_COLORS: Record<string, string> = {
  denied: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  suspended: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  closed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function LoanStatusTransition({ loanId, currentStatus }: Props) {
  const { data: transitions = [] } = useAvailableTransitions(currentStatus);
  const transitionMutation = useTransitionLoanStatus();
  const runCompliance = useRunComplianceRules(loanId);
  const { data: complianceRuns = [] } = useComplianceRuleRuns(loanId);
  const [confirm, setConfirm] = useState<{ toStatus: string; label: string } | null>(null);
  const latestRun = complianceRuns[0] as
    | { summary?: { failed_blocking?: boolean }; run_at?: string }
    | undefined;
  const blockedByCompliance = latestRun?.summary?.failed_blocking === true;
  const canTransitionWhenBlocked = (toStatus: string) =>
    ["denied", "withdrawn", "suspended"].includes(toStatus);

  if (isTerminalStatus(currentStatus)) {
    return (
      <Badge className={STATUS_COLORS[currentStatus] ?? ""}>
        {STATUS_LABELS[currentStatus] ?? currentStatus}
      </Badge>
    );
  }

  if (transitions.length === 0) return null;

  const handleTransition = () => {
    if (!confirm) return;
    transitionMutation.mutate(
      { loanId, toStatus: confirm.toStatus },
      { onSettled: () => setConfirm(null) }
    );
  };

  const dangerStatuses = new Set(["denied", "withdrawn", "suspended"]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <Button
            key={t.to_status}
            size="sm"
            variant={dangerStatuses.has(t.to_status) ? "destructive" : "default"}
            onClick={() => setConfirm({ toStatus: t.to_status, label: t.label ?? t.to_status })}
            disabled={
              transitionMutation.isPending ||
              (blockedByCompliance && !canTransitionWhenBlocked(t.to_status))
            }
          >
            {t.label ?? STATUS_LABELS[t.to_status] ?? t.to_status}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        ))}
      </div>
      {blockedByCompliance && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
          <p className="font-medium">
            Blocked by compliance checks. Resolve blocking failures before progressing loan status.
          </p>
          <p>
            Last compliance run:{" "}
            {latestRun?.run_at ? new Date(latestRun.run_at).toLocaleString() : "not available"}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void runCompliance.mutate()}
            disabled={runCompliance.isPending}
          >
            {runCompliance.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Run checks now
          </Button>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Move this loan from <strong>{STATUS_LABELS[currentStatus] ?? currentStatus}</strong> to{" "}
              <strong>{confirm ? STATUS_LABELS[confirm.toStatus] ?? confirm.toStatus : ""}</strong>?
              {confirm && dangerStatuses.has(confirm.toStatus) && (
                <span className="block mt-2 text-destructive font-medium">
                  This action may be difficult to reverse.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transitionMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransition} disabled={transitionMutation.isPending}>
              {transitionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
