import { Clock, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSLAForLoanStatus, type SLAConfiguration } from "@/hooks/useSLAConfigurations";
import { useRiskAlertsByLoan } from "@/hooks/useRiskAlerts";

interface SLAStatusCardProps {
  loanId: string;
  loanStatus: string;
}

const severityIcon: Record<string, React.ReactNode> = {
  critical: <ShieldAlert className="h-4 w-4 text-red-500" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  medium: <Clock className="h-4 w-4 text-yellow-500" />,
  low: <CheckCircle className="h-4 w-4 text-green-500" />,
};

const severityBadge: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function SLARow({ sla }: { sla: SLAConfiguration }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        {severityIcon[sla.severity] ?? <Clock className="h-4 w-4" />}
        <div>
          <p className="text-sm font-medium">{sla.name}</p>
          {sla.description && (
            <p className="text-xs text-muted-foreground">{sla.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          className={`text-xs ${severityBadge[sla.severity] ?? ""}`}
          variant="outline"
        >
          {sla.severity}
        </Badge>
        <span className="whitespace-nowrap text-sm font-mono">
          {sla.target_hours}h target
        </span>
        {sla.warning_hours != null && (
          <span className="text-xs text-muted-foreground">
            (warn @ {sla.warning_hours}h)
          </span>
        )}
      </div>
    </div>
  );
}

export function SLAStatusCard({ loanId, loanStatus }: SLAStatusCardProps) {
  const applicableSLAs = useSLAForLoanStatus(loanStatus);
  const { data: loanAlerts } = useRiskAlertsByLoan(loanId);

  const activeAlerts = loanAlerts?.filter((a) => !a.is_read) ?? [];

  if (applicableSLAs.length === 0 && activeAlerts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          SLA &amp; Risk Status
        </CardTitle>
        <CardDescription>
          Active SLA rules for the current stage and unresolved risk alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-destructive">
              Active Alerts ({activeAlerts.length})
            </h4>
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
              >
                {severityIcon[alert.severity] ?? (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
                <Badge
                  className={`shrink-0 text-xs ${severityBadge[alert.severity] ?? ""}`}
                  variant="outline"
                >
                  {alert.severity}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {applicableSLAs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">
              SLA Rules for "{loanStatus}" stage
            </h4>
            {applicableSLAs.map((sla) => (
              <SLARow key={sla.id} sla={sla} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
