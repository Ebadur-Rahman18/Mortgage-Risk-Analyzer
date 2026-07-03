import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  useRunComplianceRules,
  useComplianceRuleRuns,
  type ComplianceRuleResultRow,
} from "@/hooks/usePhase3LoanTools";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { permissionKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface Props {
  loanId: string;
}

export function LoanComplianceRunCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const canRun =
    hasPermission(permissionKey("compliance", "run")) || hasPermission("loans:update");
  const run = useRunComplianceRules(loanId);
  const { data: runs = [], isLoading } = useComplianceRuleRuns(loanId);

  const lastRun = runs[0] as { results?: ComplianceRuleResultRow[]; run_at?: string; summary?: { failed_blocking?: boolean } } | undefined;
  const results = lastRun?.results ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Compliance rules
        </CardTitle>
        <CardDescription>
          Deterministic checks (TRID/RESPA/HMDA-oriented). Supplements AI screening.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canRun && (
          <Button type="button" size="sm" disabled={run.isPending} onClick={() => void run.mutate()}>
            {run.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Run checks
          </Button>
        )}

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        {run.data && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Just ran — {run.data.summary?.passed as number} / {run.data.summary?.total as number}{" "}
              passed
            </p>
            <RuleResultList results={run.data.results} />
          </div>
        )}

        {!run.data && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Last run {lastRun?.run_at ? new Date(lastRun.run_at).toLocaleString() : ""}
            </p>
            {lastRun?.summary?.failed_blocking && (
              <p className="text-xs text-amber-700">
                Blocking failures detected. Loan progression is restricted until resolved.
              </p>
            )}
            <RuleResultList results={results} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuleResultList({ results }: { results: ComplianceRuleResultRow[] }) {
  return (
    <ul className="max-h-48 overflow-y-auto space-y-1.5 text-sm">
      {results.map((r) => (
        <li
          key={r.code}
          className={cn(
            "flex flex-wrap items-start gap-2 rounded border px-2 py-1.5",
            r.pass ? "border-green-200 bg-green-50/50 dark:bg-green-950/20" : "border-amber-200 bg-amber-50/50",
          )}
        >
          <Badge variant={r.pass ? "default" : "secondary"} className="shrink-0 text-[10px]">
            {r.pass ? "Pass" : "Fail"}
          </Badge>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-xs">{r.title}</div>
            <div className="text-[11px] text-muted-foreground">{r.message}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{r.regulation_tag}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
