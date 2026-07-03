import { useState } from "react";
import { useCheckEligibility, type EligibilityResponse } from "@/hooks/useEligibility";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Zap } from "lucide-react";

interface Props {
  loanId: string;
}

const STATUS_CONFIG = {
  eligible: { icon: CheckCircle2, label: "Eligible", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  eligible_with_conditions: { icon: AlertTriangle, label: "Eligible (conditions)", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  ineligible: { icon: XCircle, label: "Ineligible", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

export function EligibilityResults({ loanId }: Props) {
  const checkMutation = useCheckEligibility();
  const [results, setResults] = useState<EligibilityResponse | null>(null);

  const handleCheck = () => {
    checkMutation.mutate(
      { loanId },
      { onSuccess: (data) => setResults(data) }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Program Eligibility</CardTitle>
        <Button size="sm" onClick={handleCheck} disabled={checkMutation.isPending}>
          {checkMutation.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-1 h-4 w-4" />
          )}
          Run Eligibility Check
        </Button>
      </CardHeader>
      <CardContent>
        {!results ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Click "Run Eligibility Check" to evaluate this loan against all active programs.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-muted p-3">
              <div className="text-sm">
                <span className="font-medium">Scenario:</span>{" "}
                FICO {results.scenario.credit_score} · LTV {results.scenario.ltv.toFixed(1)}% · DTI {results.scenario.dti.toFixed(1)}%
                · ${results.scenario.loan_amount.toLocaleString()}
              </div>
              <Badge variant="outline">
                {results.eligible_count}/{results.total_programs} eligible
              </Badge>
            </div>

            <div className="space-y-2">
              {results.results.map((r) => {
                const config = STATUS_CONFIG[r.status];
                const Icon = config.icon;
                return (
                  <div key={r.program_id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${
                          r.status === "eligible" ? "text-green-600" :
                          r.status === "ineligible" ? "text-red-500" : "text-yellow-600"
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{r.program_name}</p>
                          <p className="text-xs text-muted-foreground">{r.product_name} · {r.product_type}</p>
                        </div>
                      </div>
                      <Badge className={config.color}>{config.label}</Badge>
                    </div>
                    {r.reasons.length > 0 && (
                      <ul className="mt-2 ml-8 text-xs text-red-600 space-y-0.5">
                        {r.reasons.map((reason, i) => <li key={i}>- {reason}</li>)}
                      </ul>
                    )}
                    {r.conditions.length > 0 && (
                      <ul className="mt-2 ml-8 text-xs text-yellow-700 space-y-0.5">
                        {r.conditions.map((c, i) => <li key={i}>- {c}</li>)}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
