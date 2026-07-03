import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortalMilestone } from "@/lib/borrowerPortalApi";

const ORDERED_TYPES = [
  "application_received",
  "processing",
  "underwriting",
  "conditional_approval",
  "clear_to_close",
  "docs_out",
  "funding",
  "closed",
] as const;

const LABELS: Record<string, string> = {
  application_received: "Application",
  processing: "Processing",
  underwriting: "Underwriting",
  conditional_approval: "Conditional",
  clear_to_close: "Clear to Close",
  docs_out: "Docs Out",
  funding: "Funding",
  closed: "Closed",
};

interface Props {
  milestones: PortalMilestone[];
}

export function PortalMilestoneTracker({ milestones }: Props) {
  const completedTypes = new Set(
    milestones.filter((m) => m.completed_at).map((m) => m.milestone_type),
  );

  let currentIdx = -1;
  for (let i = ORDERED_TYPES.length - 1; i >= 0; i--) {
    if (completedTypes.has(ORDERED_TYPES[i])) {
      currentIdx = i;
      break;
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Loan Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scroll-smooth">
          <div className="flex items-center min-w-max gap-0">
            {ORDERED_TYPES.map((type, i) => {
              const completed = completedTypes.has(type);
              const isCurrent = i === currentIdx + 1 && !completed;
              const isPast = i <= currentIdx;
              return (
                <div
                  key={type}
                  className="flex items-center snap-center"
                >
                  {/* Connector line */}
                  {i > 0 && (
                    <div
                      className={cn(
                        "h-0.5 w-6 sm:w-10",
                        isPast ? "bg-green-500" : "bg-muted",
                      )}
                    />
                  )}
                  <div className="flex flex-col items-center gap-1.5 min-w-[56px] sm:min-w-[72px]">
                    {/* Step circle */}
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                        completed && "border-green-500 bg-green-500 text-white",
                        isCurrent &&
                          "border-blue-500 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 animate-pulse",
                        !completed && !isCurrent && "border-muted bg-background text-muted-foreground",
                      )}
                    >
                      {completed ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    {/* Label */}
                    <span
                      className={cn(
                        "text-[10px] sm:text-xs leading-tight text-center",
                        completed && "font-medium text-green-700 dark:text-green-400",
                        isCurrent && "font-medium text-blue-700 dark:text-blue-300",
                        !completed && !isCurrent && "text-muted-foreground",
                      )}
                    >
                      {LABELS[type] ?? type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
