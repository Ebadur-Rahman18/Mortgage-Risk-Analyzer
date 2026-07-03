import { useLoanRiskScore } from "@/hooks/useLoanRiskScore";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldAlert, ShieldCheck, Shield, ShieldQuestion, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const RISK_CONFIG: Record<string, { color: string; bg: string; icon: typeof Shield; label: string }> = {
  low: { color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30", icon: ShieldCheck, label: "Low Risk" },
  medium: { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", icon: Shield, label: "Medium Risk" },
  high: { color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30", icon: ShieldAlert, label: "High Risk" },
  critical: { color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", icon: ShieldAlert, label: "Critical Risk" },
};

interface RiskBadgeProps {
  loanId: string;
  showScore?: boolean;
  size?: "sm" | "md";
}

export function RiskBadge({ loanId, showScore = false, size = "md" }: RiskBadgeProps) {
  const { data: risk, isLoading } = useLoanRiskScore(loanId);

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (!risk) {
    return (
      <Badge variant="outline" className="gap-1">
        <ShieldQuestion className="h-3 w-3" />
        {size === "md" && "No score"}
      </Badge>
    );
  }

  const config = RISK_CONFIG[risk.risk_level] ?? RISK_CONFIG.medium;
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn("gap-1 border-0", config.bg, config.color, size === "sm" && "text-xs px-1.5 py-0")}
    >
      <Icon className={cn("h-3 w-3", size === "sm" && "h-3 w-3")} />
      {size === "md" && config.label}
      {showScore && <span className="ml-0.5 font-mono">{risk.overall_risk_score}</span>}
    </Badge>
  );

  if (size === "sm") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>{config.label} — Score: {risk.overall_risk_score}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
