import {
  useLoanMilestones,
  useCreateLoanMilestone,
  useUpdateLoanMilestone,
} from "@/hooks/useLoanMilestones";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, CheckCircle2, Circle, Lock } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TERMINAL_STATUSES = ["closed", "cancelled", "withdrawn"];

const MILESTONE_TYPES = [
  "application_received",
  "disclosure_sent",
  "appraisal_ordered",
  "appraisal_received",
  "title_ordered",
  "title_received",
  "submitted_to_uw",
  "conditional_approval",
  "clear_to_close",
  "closing_scheduled",
  "docs_out",
  "funding",
] as const;

const MILESTONE_LABELS: Record<string, string> = {
  application_received: "Application Received",
  disclosure_sent: "Disclosure Sent",
  appraisal_ordered: "Appraisal Ordered",
  appraisal_received: "Appraisal Received",
  title_ordered: "Title Ordered",
  title_received: "Title Received",
  submitted_to_uw: "Submitted to UW",
  conditional_approval: "Conditional Approval",
  clear_to_close: "Clear to Close",
  closing_scheduled: "Closing Scheduled",
  docs_out: "Docs Out",
  funding: "Funding",
};

interface MilestoneTrackerProps {
  loanId: string;
  loanStatus?: string;
}

export function MilestoneTracker({ loanId, loanStatus }: MilestoneTrackerProps) {
  const { data: milestones, isLoading } = useLoanMilestones(loanId);
  const createMilestone = useCreateLoanMilestone();
  const updateMilestone = useUpdateLoanMilestone();
  const { hasPermission } = useEffectivePermissions();
  const isTerminal = !!loanStatus && TERMINAL_STATUSES.includes(loanStatus);
  const canUpdate = hasPermission("loans:update") && !isTerminal;

  const [open, setOpen] = useState(false);
  const [milestoneType, setMilestoneType] = useState<string>(MILESTONE_TYPES[0]);
  const [name, setName] = useState("");

  const handleCreate = () => {
    const label = name.trim() || MILESTONE_LABELS[milestoneType] || milestoneType;
    createMilestone.mutate(
      { loan_id: loanId, milestone_type: milestoneType, name: label },
      {
        onSuccess: () => {
          setName("");
          setMilestoneType(MILESTONE_TYPES[0]);
          setOpen(false);
        },
      }
    );
  };

  const handleComplete = (msId: string) => {
    updateMilestone.mutate({
      id: msId,
      loanId,
      data: { completed_at: new Date().toISOString() },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Milestones</CardTitle>
          <CardDescription>Key stages in the loan lifecycle</CardDescription>
        </div>
        {canUpdate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add Milestone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Milestone</DialogTitle>
                <DialogDescription>Add a lifecycle milestone for this loan.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <SearchableSelect
                  value={milestoneType}
                  onChange={setMilestoneType}
                  options={MILESTONE_TYPES.map((t) => ({
                    value: t,
                    label: MILESTONE_LABELS[t] ?? t,
                  }))}
                />
                <Input
                  placeholder={`Name (defaults to "${MILESTONE_LABELS[milestoneType] ?? milestoneType}")`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMilestone.isPending}>
                  {createMilestone.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isTerminal && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Milestones are locked for {loanStatus} loans.
          </div>
        )}
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !milestones || milestones.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No milestones recorded.</p>
        ) : (
          <div className="flex items-start gap-0 overflow-x-auto py-2">
            {milestones.map((ms, idx) => {
              const done = !!ms.completed_at;
              return (
                <div key={ms.id} className="flex items-start">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <button
                      disabled={done || !canUpdate}
                      onClick={() => handleComplete(ms.id)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                        done
                          ? "border-green-500 bg-green-100 text-green-600 dark:bg-green-900/30"
                          : "border-muted-foreground/30 bg-background text-muted-foreground hover:border-primary hover:text-primary"
                      )}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </button>
                    <span className={cn("mt-1.5 text-xs font-medium text-center max-w-[110px]", done && "text-green-600 dark:text-green-400")}>
                      {ms.name}
                    </span>
                    {ms.completed_at && (
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(ms.completed_at)}
                      </span>
                    )}
                  </div>
                  {idx < milestones.length - 1 && (
                    <div className={cn("mt-3.5 h-0.5 w-8 shrink-0", done ? "bg-green-500" : "bg-muted-foreground/20")} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
