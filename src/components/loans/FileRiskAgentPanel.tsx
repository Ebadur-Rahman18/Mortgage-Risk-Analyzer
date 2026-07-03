// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Loader2,
  BrainCircuit,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileRiskAgent, type LoanRiskResult } from "@/hooks/useFileRiskAgent";
import { useCreateTask } from "@/hooks/useTasks";
import { useLoans, type Loan } from "@/hooks/useLoans";
import { useToast } from "@/hooks/use-toast";

// ── Risk display config ──────────────────────────────────────────────────────

const RISK_CONFIG = {
  low: {
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    icon: ShieldCheck,
    label: "Low",
    dot: "bg-green-500",
  },
  medium: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    icon: Shield,
    label: "Medium",
    dot: "bg-amber-500",
  },
  high: {
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800",
    icon: ShieldAlert,
    label: "High",
    dot: "bg-orange-500",
  },
  critical: {
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    icon: ShieldAlert,
    label: "Critical",
    dot: "bg-red-500",
  },
} as const;

function riskLevelToPriority(level: LoanRiskResult["risk_level"]): string {
  switch (level) {
    case "critical": return "urgent";
    case "high":     return "high";
    case "medium":   return "medium";
    default:         return "low";
  }
}

function buildTaskDescription(result: LoanRiskResult): string {
  const lines: string[] = [
    `Loan Risk Agent flagged Loan #${result.loan_number}${result.borrower_name ? ` (${result.borrower_name})` : ""} as ${result.risk_level.toUpperCase()} risk (score: ${result.overall_risk_score}/100).`,
    "",
    "Risk Factors:",
    ...result.risk_factors.map(f => `• [${f.type}] ${f.description}`),
    "",
    "Sub-scores:",
    `• Lock Expiry: ${result.lock_expiry_risk}`,
    `• Stall: ${result.stall_risk}`,
    `• Conditions: ${result.condition_risk}`,
    `• Milestones: ${result.milestone_risk}`,
  ];
  return lines.join("\n");
}

// ── Sub-score bar ─────────────────────────────────────────────────────────────

function SubScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 75 ? "bg-red-500" :
    pct >= 50 ? "bg-orange-500" :
    pct >= 25 ? "bg-amber-500" :
    "bg-green-500";

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono font-medium">{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

interface RiskResultCardProps {
  result: LoanRiskResult;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
}

function RiskResultCard({ result, expanded, onToggleExpand, selected, onToggleSelect }: RiskResultCardProps) {
  const config = RISK_CONFIG[result.risk_level] ?? RISK_CONFIG.medium;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        config.bg,
        config.border,
        selected && "ring-2 ring-primary ring-offset-1",
      )}
    >
      {/* Header row — clickable to expand */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {/* Select checkbox — stops propagation so it doesn't also toggle expand */}
        <div
          onClick={onToggleSelect}
          className="flex-shrink-0"
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => {/* handled by onClick above */}}
            className="pointer-events-none"
          />
        </div>

        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", config.dot)} />

        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm">Loan #{result.loan_number}</span>
          {result.borrower_name && (
            <span className="text-muted-foreground text-sm"> — {result.borrower_name}</span>
          )}
        </div>

        <Badge variant="outline" className={cn("gap-1 border-0 text-xs flex-shrink-0", config.bg, config.color)}>
          <Icon className="h-3 w-3" />
          {config.label}
          <span className="font-mono ml-0.5">{result.overall_risk_score}</span>
        </Badge>

        {expanded
          ? <ChevronUp className={cn("h-4 w-4 flex-shrink-0", config.color)} />
          : <ChevronDown className={cn("h-4 w-4 flex-shrink-0", config.color)} />
        }
      </div>

      {/* Collapsed preview: top risk factors */}
      {!expanded && result.risk_factors.length > 0 && (
        <div className="px-3 pb-3 space-y-0.5 pl-10">
          {result.risk_factors.slice(0, 2).map((f, i) => (
            <p key={i} className={cn("text-xs", config.color)}>• {f.description}</p>
          ))}
          {result.risk_factors.length > 2 && (
            <p className={cn("text-xs opacity-60", config.color)}>
              +{result.risk_factors.length - 2} more — click to expand
            </p>
          )}
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="px-3 pb-3 space-y-4 border-t border-inherit pt-3 ml-3 mr-1">
          {/* All risk factors */}
          {result.risk_factors.length > 0 && (
            <div className="space-y-1">
              <p className={cn("text-xs font-semibold uppercase tracking-wide opacity-70", config.color)}>
                Risk Factors ({result.risk_factors.length})
              </p>
              <ul className="space-y-1">
                {result.risk_factors.map((f, i) => (
                  <li key={i} className={cn("text-xs", config.color)}>
                    • <span className="font-medium">[{f.type}]</span> {f.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sub-score bars */}
          <div className="space-y-2">
            <p className={cn("text-xs font-semibold uppercase tracking-wide opacity-70", config.color)}>
              Sub-scores
            </p>
            <div className="space-y-2">
              <SubScoreBar label="Lock Expiry" value={result.lock_expiry_risk} />
              <SubScoreBar label="Stall Risk" value={result.stall_risk} />
              <SubScoreBar label="Conditions" value={result.condition_risk} />
              <SubScoreBar label="Milestones" value={result.milestone_risk} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface FileRiskAgentPanelProps {
  /** Pre-loaded loans from a parent page. When omitted the panel fetches its own. */
  loans?: Loan[];
  /** Custom trigger element. Defaults to the standard "Analyze Pipeline Risk" button. */
  trigger?: React.ReactNode;
  /** Controlled open state (optional). */
  open?: boolean;
  /** Controlled open state callback (optional). */
  onOpenChange?: (open: boolean) => void;
}

export function FileRiskAgentPanel({
  loans: loansProp,
  trigger,
  open: openProp,
  onOpenChange,
}: FileRiskAgentPanelProps) {
  // Fetch loans internally only when the parent doesn't supply them
  const { data: fetchedResult } = useLoans();
  const loans = loansProp ?? fetchedResult?.rows ?? [];
  const navigate = useNavigate();
  const { toast } = useToast();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const [scope, setScope] = useState<"all" | "select">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Expanded result card id
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  // Selected results for task creation
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);

  const { mutate: runAnalysis, isPending, data, reset } = useFileRiskAgent();
  const createTask = useCreateTask();

  function toggleLoan(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAnalyze() {
    const loanIds = scope === "select" ? Array.from(selectedIds) : undefined;
    if (scope === "select" && (!loanIds || loanIds.length === 0)) return;
    setExpandedResultId(null);
    setSelectedResultIds(new Set());
    runAnalysis({ loanIds });
  }

  function handleScopeChange(newScope: "all" | "select") {
    setScope(newScope);
    reset();
    setSelectedIds(new Set());
    setExpandedResultId(null);
    setSelectedResultIds(new Set());
  }

  function toggleResultExpand(loanId: string) {
    setExpandedResultId(prev => (prev === loanId ? null : loanId));
  }

  function toggleResultSelect(e: React.MouseEvent, loanId: string) {
    e.stopPropagation();
    setSelectedResultIds(prev => {
      const next = new Set(prev);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
  }

  function selectAllFlagged() {
    setSelectedResultIds(new Set(flagged.map(r => r.loan_id)));
  }

  function clearResultSelection() {
    setSelectedResultIds(new Set());
  }

  async function handleCreateTasks() {
    const toCreate = flagged.filter(r => selectedResultIds.has(r.loan_id));
    if (toCreate.length === 0) return;

    setIsCreatingTasks(true);
    let successCount = 0;

    for (const result of toCreate) {
      try {
        await createTask.mutateAsync({
          title: `Review loan risk: #${result.loan_number}${result.borrower_name ? ` — ${result.borrower_name}` : ""}`,
          description: buildTaskDescription(result),
          status: "todo",
          priority: riskLevelToPriority(result.risk_level),
        });
        successCount++;
      } catch {
        // individual errors are handled by the mutation's onError toast
      }
    }

    setIsCreatingTasks(false);
    setSelectedResultIds(new Set());

    if (successCount > 0) {
      toast({
        title: `${successCount} task${successCount !== 1 ? "s" : ""} created`,
        description: "Navigate to the Tasks tab to view them.",
        action: (
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => { setOpen(false); navigate("/tasks"); }}
          >
            View Tasks <ArrowRight className="h-3 w-3" />
          </Button>
        ) as any,
      });
    }
  }

  // Partition results
  const results = data?.results ?? [];
  const flagged = results.filter(r => r.risk_level !== "low");
  const clean = results.filter(r => r.risk_level === "low");

  const canAnalyze = scope === "all" || selectedIds.size > 0;
  const allFlaggedSelected = flagged.length > 0 && selectedResultIds.size === flagged.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <BrainCircuit className="h-4 w-4" />
            Analyze Pipeline Risk
          </Button>
        )}
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5" />
            File Risk Agent
          </SheetTitle>
          <SheetDescription>
            Rule-based pipeline analysis — lock expiry, stall detection, condition backlogs, and milestone delays.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">

            {/* Scope selector */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Scope</p>
              <div className="flex gap-2">
                {(["all", "select"] as const).map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={scope === s ? "default" : "outline"}
                    onClick={() => handleScopeChange(s)}
                    className="capitalize"
                  >
                    {s === "all" ? "All Loans" : "Select Loans"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Loan selector */}
            {scope === "select" && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Select loans to analyze ({selectedIds.size} selected)
                </p>
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {loans.length === 0 && (
                    <p className="text-sm text-muted-foreground px-3 py-2">No loans available</p>
                  )}
                  {loans.map(loan => {
                    const b = loan.borrowers;
                    const name = b
                      ? [b.first_name, b.last_name].filter(Boolean).join(" ")
                      : null;
                    return (
                      <label
                        key={loan.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedIds.has(loan.id)}
                          onCheckedChange={() => toggleLoan(loan.id)}
                        />
                        <span className="text-sm">
                          <span className="font-medium">#{loan.loan_number}</span>
                          {name && <span className="text-muted-foreground"> — {name}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Analyze button */}
            <Button
              onClick={handleAnalyze}
              disabled={isPending || !canAnalyze}
              className="w-full gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <BrainCircuit className="h-4 w-4" />
                  Analyze Pipeline Risk
                </>
              )}
            </Button>

            {/* Results */}
            {data && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Results</p>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(data.analyzed_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {flagged.length === 0 && clean.length === 0 && (
                    <p className="text-sm text-muted-foreground">No loans found to analyze.</p>
                  )}

                  {/* Flagged loans (medium / high / critical) */}
                  {flagged.length > 0 && (
                    <div className="space-y-2">
                      {/* Select all / clear row */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {selectedResultIds.size > 0
                            ? `${selectedResultIds.size} of ${flagged.length} selected`
                            : `${flagged.length} flagged loan${flagged.length !== 1 ? "s" : ""}`
                          }
                        </p>
                        <div className="flex gap-2">
                          {selectedResultIds.size > 0 ? (
                            <button
                              onClick={clearResultSelection}
                              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                            >
                              Clear
                            </button>
                          ) : null}
                          <button
                            onClick={allFlaggedSelected ? clearResultSelection : selectAllFlagged}
                            className="text-xs text-primary hover:text-primary/80 underline-offset-2 hover:underline"
                          >
                            {allFlaggedSelected ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                      </div>

                      {flagged.map(r => (
                        <RiskResultCard
                          key={r.loan_id}
                          result={r}
                          expanded={expandedResultId === r.loan_id}
                          onToggleExpand={() => toggleResultExpand(r.loan_id)}
                          selected={selectedResultIds.has(r.loan_id)}
                          onToggleSelect={(e) => toggleResultSelect(e, r.loan_id)}
                        />
                      ))}

                      {/* Create tasks CTA */}
                      {selectedResultIds.size > 0 && (
                        <Button
                          onClick={handleCreateTasks}
                          disabled={isCreatingTasks}
                          className="w-full gap-2 mt-1"
                          variant="default"
                        >
                          {isCreatingTasks ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Creating tasks…
                            </>
                          ) : (
                            <>
                              <ClipboardList className="h-4 w-4" />
                              Create {selectedResultIds.size} Task{selectedResultIds.size !== 1 ? "s" : ""} from Selected
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Clean loans summary */}
                  {clean.length > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm text-green-700 dark:text-green-400">
                        {clean.length} loan{clean.length !== 1 ? "s" : ""} — No issues found
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
