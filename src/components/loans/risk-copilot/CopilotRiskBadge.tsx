import { Badge } from "@/components/ui/badge";
import { formatRiskLevel } from "@/lib/mortgage-calculations";

const LEVEL_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

interface CopilotRiskBadgeProps {
  analysis?: {
    risk_level: string;
    risk_score: number;
    is_outdated: boolean;
  } | null;
  size?: "sm" | "md";
}

export function CopilotRiskBadge({ analysis, size = "md" }: CopilotRiskBadgeProps) {
  if (!analysis || analysis.is_outdated) {
    return (
      <Badge variant="outline" className={size === "sm" ? "text-xs" : ""}>
        —
      </Badge>
    );
  }

  const level = analysis.risk_level.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={`border-0 ${LEVEL_STYLES[level] ?? ""} ${size === "sm" ? "text-xs px-1.5" : ""}`}
    >
      {formatRiskLevel(analysis.risk_level)}
      {size === "md" ? ` (${analysis.risk_score})` : ""}
    </Badge>
  );
}
