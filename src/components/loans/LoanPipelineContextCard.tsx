import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  OTHER_COLUMN_ID,
  PIPELINE_STAGES,
  STATUS_LABELS,
  getColumnIdForLoanStatus,
} from "@/lib/loan-pipeline-stages";
import { formatDate } from "@/lib/utils";

interface LoanPipelineContextCardProps {
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  lockDate?: string | null;
}

export function LoanPipelineContextCard({
  status,
  createdAt,
  updatedAt,
  lockDate,
}: LoanPipelineContextCardProps) {
  const currentColumn = getColumnIdForLoanStatus(status);
  const currentStageIndex = PIPELINE_STAGES.findIndex((stage) => stage.id === currentColumn);
  const currentStageLabel =
    currentColumn === OTHER_COLUMN_ID
      ? STATUS_LABELS[status] ?? status
      : PIPELINE_STAGES[currentStageIndex]?.label ?? (STATUS_LABELS[status] ?? status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline (Synced from CRM)</CardTitle>
        <CardDescription>
          External pipeline context from your CRM/LOS. This system displays status only and does not control stage changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Current stage</span>
          <Badge variant="secondary">{currentStageLabel}</Badge>
        </div>

        <div className="grid gap-2">
          {PIPELINE_STAGES.map((stage, index) => {
            const isCurrent = stage.id === currentColumn;
            const isComplete = currentStageIndex >= 0 && index < currentStageIndex;
            return (
              <div
                key={stage.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={isCurrent ? "font-medium text-foreground" : "text-muted-foreground"}>
                    {stage.label}
                  </span>
                </div>
                {isCurrent && <Badge variant="outline">Current</Badge>}
              </div>
            );
          })}
        </div>

        <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Loan created</p>
            <p className="font-medium">{createdAt ? formatDate(createdAt) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last sync/update</p>
            <p className="font-medium">{updatedAt ? formatDate(updatedAt) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lock date</p>
            <p className="font-medium">{lockDate ? formatDate(lockDate) : "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
