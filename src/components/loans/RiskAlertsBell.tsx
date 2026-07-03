import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShieldAlert, AlertTriangle, Clock, Lock, XCircle } from "lucide-react";
import {
  useRiskAlerts,
  useUnreadRiskAlertCount,
  useDismissRiskAlert,
  useDismissAllRiskAlerts,
} from "@/hooks/useRiskAlerts";

const alertIconMap: Record<string, React.ReactNode> = {
  critical_risk: <ShieldAlert className="h-4 w-4 text-red-500" />,
  high_risk: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  lock_expiry: <Lock className="h-4 w-4 text-yellow-600" />,
  stall: <Clock className="h-4 w-4 text-amber-500" />,
  sla_warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  sla_breach: <XCircle className="h-4 w-4 text-red-600" />,
};

const severityColorMap: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

export function RiskAlertsBell() {
  const { data: unreadCount } = useUnreadRiskAlertCount();
  const { data: alerts, isLoading } = useRiskAlerts("unread");
  const dismissOne = useDismissRiskAlert();
  const dismissAll = useDismissAllRiskAlerts();

  const count = unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <ShieldAlert className="h-[18px] w-[18px]" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
            >
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Risk Alerts</span>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <>
                <Badge variant="secondary" className="text-xs">
                  {count} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => dismissAll.mutate()}
                >
                  Dismiss all
                </Button>
              </>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="p-6 text-center">
              <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                No active risk alerts
              </p>
            </div>
          ) : (
            alerts.slice(0, 10).map((alert) => (
              <DropdownMenuItem
                key={alert.id}
                className="flex items-start gap-3 p-3 cursor-pointer"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="mt-0.5 shrink-0">
                  {alertIconMap[alert.alert_type] ?? (
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        severityColorMap[alert.severity] ?? ""
                      }`}
                    >
                      {alert.severity}
                    </span>
                    {alert.loan && (
                      <Link
                        to={`/loans/${alert.loan_id}`}
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(alert.loan as any)?.loan_number ?? "View loan"}
                      </Link>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-tight">{alert.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {alert.message}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissOne.mutate(alert.id);
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
