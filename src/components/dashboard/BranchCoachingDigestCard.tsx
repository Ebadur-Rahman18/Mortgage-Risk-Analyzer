import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useLatestBranchDigest,
  useBranchDigestHistory,
  useGenerateBranchDigest,
  type RecommendedAction,
  type BranchCoachingDigestRow,
} from "@/hooks/useBranchCoachingDigest";
import { useCreateActionItem } from "@/hooks/useActionItems";
import { formatDate, cn } from "@/lib/utils";
import {
  GraduationCap,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  History,
  CheckCircle2,
  ListTodo,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

function priorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-100 text-[10px]">
          High
        </Badge>
      );
    case "low":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100 text-[10px]">
          Low
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          Normal
        </Badge>
      );
  }
}

function ActionRow({
  action,
  onCreateTask,
  isCreating,
  isCreated,
}: {
  action: RecommendedAction;
  onCreateTask: () => void;
  isCreating: boolean;
  isCreated: boolean;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{action.title}</span>
            {priorityBadge(action.priority)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {action.assigned_to_name && (
              <span>Assign to: <strong>{action.assigned_to_name}</strong></span>
            )}
            {action.loan_number && (
              <Link
                to={`/loans/${action.loan_id}`}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <LinkIcon className="h-3 w-3" />
                {action.loan_number}
              </Link>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={isCreated ? "ghost" : "outline"}
          onClick={onCreateTask}
          disabled={isCreating || isCreated}
          className="gap-1.5 shrink-0"
        >
          {isCreated ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              Created
            </>
          ) : isCreating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <ListTodo className="h-3.5 w-3.5" />
              Create Task
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function DigestContent({
  data,
  showActions,
}: {
  data: BranchCoachingDigestRow;
  showActions?: boolean;
}) {
  const [narrativeOpen, setNarrativeOpen] = useState(true);
  const createAction = useCreateActionItem();
  const [createdSet, setCreatedSet] = useState<Set<number>>(new Set());
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);

  const handleCreateTask = async (action: RecommendedAction, idx: number) => {
    setCreatingIdx(idx);
    try {
      await createAction.mutateAsync({
        title: action.title,
        description: action.description,
        assigned_to_user_id: action.assigned_to_user_id || undefined,
        loan_id: action.loan_id || undefined,
        priority: action.priority || "normal",
        source: "agent",
      });
      setCreatedSet((prev) => new Set(prev).add(idx));
      toast.success(`Task "${action.title}" created`);
    } catch {
      // Error already toasted by useCreateActionItem
    } finally {
      setCreatingIdx(null);
    }
  };

  const branchName =
    (data.metadata as Record<string, unknown>)?.branch_name as string | undefined;

  return (
    <div className="space-y-4">
      {/* Period + meta */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        <span>
          Period: {data.period_start} — {data.period_end}
        </span>
        {branchName && <Badge variant="outline" className="text-[10px]">{branchName}</Badge>}
        {data.latency_ms != null && (
          <span>· {(data.latency_ms / 1000).toFixed(1)}s</span>
        )}
        <span>· {formatDate(data.created_at)}</span>
      </div>

      {/* Narrative */}
      <Collapsible open={narrativeOpen} onOpenChange={setNarrativeOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium hover:underline underline-offset-4 w-full text-left">
            <Sparkles className="h-4 w-4 text-blue-600" />
            Coaching Narrative
            {narrativeOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-line">
            {data.narrative}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Recommended actions */}
      {showActions !== false && data.recommended_actions?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            Recommended Actions
          </h4>
          {data.recommended_actions.map((action, idx) => (
            <ActionRow
              key={idx}
              action={action}
              onCreateTask={() => handleCreateTask(action, idx)}
              isCreating={creatingIdx === idx}
              isCreated={createdSet.has(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface BranchCoachingDigestCardProps {
  branchId: string | null;
}

export function BranchCoachingDigestCard({ branchId }: BranchCoachingDigestCardProps) {
  const { data: latest, isLoading: latestLoading } = useLatestBranchDigest(branchId);
  const { data: history } = useBranchDigestHistory(branchId, 5);
  const generateDigest = useGenerateBranchDigest();
  const [showHistory, setShowHistory] = useState(false);

  const pastRuns = (history ?? []).slice(1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Weekly Coaching Digest</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {pastRuns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="gap-1.5"
              >
                <History className="h-3.5 w-3.5" />
                {showHistory ? "Hide" : `${pastRuns.length} past`}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => generateDigest.mutate(branchId)}
              disabled={generateDigest.isPending}
              className="gap-2"
            >
              {generateDigest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {latest ? "Refresh" : "Generate Now"}
            </Button>
          </div>
        </div>
        <CardDescription>
          AI-driven coaching narrative — what's working, what's lagging, and 3 actions
          to move the needle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {latestLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : generateDigest.isPending && !latest ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Analyzing branch performance…
            </p>
          </div>
        ) : !latest ? (
          <div className="text-center py-8">
            <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground mb-3">
              No coaching digest has been generated yet.
            </p>
            <Button
              onClick={() => generateDigest.mutate(branchId)}
              disabled={generateDigest.isPending}
              className="gap-2"
            >
              {generateDigest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GraduationCap className="h-4 w-4" />
              )}
              Generate Coaching Digest
            </Button>
          </div>
        ) : (
          <>
            <DigestContent data={latest} />

            {showHistory && pastRuns.length > 0 && (
              <div className="mt-6 space-y-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Previous Digests
                </h4>
                {pastRuns.map((run) => (
                  <Collapsible key={run.id}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 w-full text-left rounded-md border p-3 hover:bg-accent/50 transition-colors">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            {run.period_start} — {run.period_end}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {run.recommended_actions?.length ?? 0} actions
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(run.created_at)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <DigestContent data={run} showActions={false} />
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
