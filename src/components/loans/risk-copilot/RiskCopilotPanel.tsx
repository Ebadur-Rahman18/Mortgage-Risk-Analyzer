import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Shield, History } from "lucide-react";
import {
  useLatestLoanRiskAnalysis,
  useAnalyzeMortgage,
} from "@/hooks/useLoanRiskAnalyses";
import { formatRiskLevel } from "@/lib/mortgage-calculations";
import { formatDate } from "@/lib/utils";
import { LoanDocumentsPanel } from "@/components/loans/documents/LoanDocumentsPanel";
import { RiskCopilotChatPanel } from "@/components/loans/risk-copilot/RiskCopilotChatPanel";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";

const LEVEL_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

interface RiskCopilotPanelProps {
  loanId: string;
}

export function RiskCopilotPanel({ loanId }: RiskCopilotPanelProps) {
  const { hasPermission } = useEffectivePermissions();
  const canRun = hasPermission("loan_risk_analyses:run");
  const { data: latest, analyses, isLoading } = useLatestLoanRiskAnalysis(loanId);
  const analyze = useAnalyzeMortgage();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b pb-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Mortgage Risk Copilot
        </h2>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>AI Risk Analysis</CardTitle>
            <CardDescription>
              Structured risk score using loan data and uploaded documents
            </CardDescription>
          </div>
          {canRun && (
            <Button
              onClick={() => analyze.mutate(loanId)}
              disabled={analyze.isPending}
            >
              {analyze.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Run Analysis
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : latest && !latest.is_outdated ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-3xl font-bold">{latest.risk_score}</span>
                <span className="text-muted-foreground">/ 100</span>
                <Badge className={LEVEL_STYLES[latest.risk_level.toLowerCase()] ?? ""}>
                  {formatRiskLevel(latest.risk_level)}
                </Badge>
                {latest.dti != null && (
                  <Badge variant="outline">DTI: {latest.dti}%</Badge>
                )}
                {latest.ltv != null && (
                  <Badge variant="outline">LTV: {latest.ltv}%</Badge>
                )}
              </div>
              <p className="text-sm leading-relaxed">{latest.summary}</p>
              {latest.risk_factors.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Risk factors</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {latest.risk_factors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {latest.recommendations.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Recommendations</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {latest.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Analyzed {formatDate(latest.created_at)}
                {latest.model_used ? ` · ${latest.model_used}` : ""}
              </p>
            </div>
          ) : latest?.is_outdated ? (
            <p className="text-sm text-muted-foreground">
              The latest analysis is outdated after loan edits. Run a new analysis to refresh.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No analysis yet. Upload documents and run analysis to get a risk score.
            </p>
          )}
        </CardContent>
      </Card>

      {analyses.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Analysis history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analyses.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.risk_score}/100</span>
                  <Badge variant="outline">{formatRiskLevel(a.risk_level)}</Badge>
                  {a.is_outdated && (
                    <Badge variant="secondary">Outdated</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(a.created_at)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <LoanDocumentsPanel loanId={loanId} />

      <RiskCopilotChatPanel loanId={loanId} />
    </div>
  );
}
