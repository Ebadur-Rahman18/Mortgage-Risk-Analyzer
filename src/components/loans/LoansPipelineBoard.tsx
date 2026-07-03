import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { Loan } from "@/hooks/useLoans";
import { useTransitionLoanStatus } from "@/hooks/useLoanTransitions";
import {
  getColumnIdForLoanStatus,
  getEntryStatusForColumn,
  isLoanStatusExternallyManaged,
  OTHER_COLUMN_ID,
  PIPELINE_STAGES,
  type PipelineStageId,
} from "@/lib/loan-pipeline-stages";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GripVertical, Link2, Loader2, Lock } from "lucide-react";

const COL_PREFIX = "pipeline-col:";

const pipelineCollision: CollisionDetection = (args) => {
  const first = pointerWithin(args);
  if (first.length) return first;
  return rectIntersection(args);
};

function droppableId(stageId: PipelineStageId): string {
  return `${COL_PREFIX}${stageId}`;
}

function parseStageFromDroppableId(id: string): PipelineStageId | null {
  if (!id.startsWith(COL_PREFIX)) return null;
  return id.slice(COL_PREFIX.length) as PipelineStageId;
}

const RISK_CHIP: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function borrowerName(loan: Loan): string {
  const b = loan.borrowers;
  if (!b) return "—";
  return [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
}

function isLockExpiringSoon(loan: Loan): boolean {
  if (loan.status === "closed" || !loan.lock_expiration_date) return false;
  const end = new Date(loan.lock_expiration_date);
  const now = new Date();
  const week = 7 * 24 * 60 * 60 * 1000;
  return end >= now && end.getTime() <= now.getTime() + week;
}

function groupLoansByColumn(loans: Loan[]): Map<string, Loan[]> {
  const map = new Map<string, Loan[]>();
  for (const s of PIPELINE_STAGES) map.set(s.id, []);
  map.set(OTHER_COLUMN_ID, []);

  for (const loan of loans) {
    const col = getColumnIdForLoanStatus(loan.status);
    const list = map.get(col);
    if (list) list.push(loan);
    else map.get(OTHER_COLUMN_ID)!.push(loan);
  }
  return map;
}

interface LoanPipelineCardProps {
  loan: Loan;
  canDrag: boolean;
  showRawStatus?: boolean;
  /** When user can edit but this loan is sync-managed, explain missing drag handle */
  externalManaged?: boolean;
}

function LoanPipelineCard({ loan, canDrag, showRawStatus, externalManaged }: LoanPipelineCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: loan.id,
    disabled: !canDrag,
  });

  const risk = loan.loan_risk_scores;
  const riskLevel = risk?.risk_level ?? null;
  const riskClass = riskLevel ? RISK_CHIP[riskLevel] ?? RISK_CHIP.medium : "";

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const lockSoon = isLockExpiringSoon(loan);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        isDragging && "opacity-60 ring-2 ring-primary/30",
      )}
    >
      <div className="flex gap-0">
        {canDrag ? (
          <button
            type="button"
            className="flex shrink-0 cursor-grab touch-none items-center justify-center border-r bg-muted/40 px-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label="Drag to change stage"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : externalManaged ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex shrink-0 cursor-help items-center justify-center border-r bg-muted/30 px-1 text-muted-foreground"
                  aria-label="Status managed by external system"
                >
                  <Link2 className="h-3.5 w-3.5 opacity-70" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Status is managed by your LOS or import sync. Change stage in the source system or edit the loan form if
                allowed.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        <Link
          to={`/loans/${loan.id}`}
          className="min-w-0 flex-1 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="font-medium leading-tight">{loan.loan_number}</div>
          <div className="mt-0.5 truncate text-sm text-muted-foreground">{borrowerName(loan)}</div>
          {loan.loan_amount != null && (
            <div className="mt-1 text-xs text-muted-foreground">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(Number(loan.loan_amount))}
            </div>
          )}
          {showRawStatus && (
            <div className="mt-1 text-xs font-mono text-muted-foreground">{loan.status}</div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {riskLevel && (
              <span
                className={cn(
                  "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                  riskClass,
                )}
              >
                {riskLevel}
              </span>
            )}
            {lockSoon && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                      <Lock className="h-2.5 w-2.5" />
                      Lock
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Lock expires within 7 days</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}

interface ColumnProps {
  stageId: PipelineStageId | typeof OTHER_COLUMN_ID;
  title: string;
  loans: Loan[];
  loanCountLabel: string;
  allowDrop: boolean;
  canUpdate: boolean;
  canDragLoan: (loan: Loan) => boolean;
  isExternalManaged: (loan: Loan) => boolean;
}

function PipelineColumn({
  stageId,
  title,
  loans,
  loanCountLabel,
  allowDrop,
  canUpdate,
  canDragLoan,
  isExternalManaged,
}: ColumnProps) {
  const dropId =
    allowDrop && stageId !== OTHER_COLUMN_ID ? droppableId(stageId as PipelineStageId) : `no-drop-${stageId}`;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    disabled: !allowDrop,
  });

  return (
    <Card
      className={cn(
        "flex w-[280px] shrink-0 flex-col border bg-muted/20",
        allowDrop && isOver && "ring-2 ring-primary/40",
      )}
    >
      <CardHeader className="space-y-1 py-3 pb-2">
        <CardTitle className="text-sm font-semibold" id={`heading-col-${stageId}`}>
          {title}
          <span className="ml-1.5 font-normal text-muted-foreground">({loanCountLabel})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-2 pt-0">
        <div ref={allowDrop ? setNodeRef : undefined} className="flex min-h-[min(60vh,520px)] flex-1 flex-col">
          <ScrollArea className="h-[min(60vh,520px)] flex-1 pr-2">
            <div
              className="flex flex-col gap-2 pb-2"
              role="list"
              aria-labelledby={`heading-col-${stageId}`}
            >
              {loans.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">No loans</p>
              ) : (
                loans.map((loan) => (
                  <div key={loan.id} role="listitem">
                    <LoanPipelineCard
                      loan={loan}
                      canDrag={canDragLoan(loan)}
                      showRawStatus={stageId === OTHER_COLUMN_ID}
                      externalManaged={canUpdate && isExternalManaged(loan)}
                    />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

export interface LoansPipelineBoardProps {
  loans: Loan[];
  isLoading?: boolean;
  canUpdate: boolean;
}

export function LoansPipelineBoard({ loans, isLoading, canUpdate }: LoansPipelineBoardProps) {
  const transitionStatus = useTransitionLoanStatus();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const grouped = useMemo(() => groupLoansByColumn(loans), [loans]);

  const isExternalManaged = (loan: Loan) =>
    isLoanStatusExternallyManaged(loan.data_source ?? null, loan.external_id ?? null);

  const canDragLoan = (loan: Loan) => canUpdate && !isExternalManaged(loan);

  const activeLoan = activeId ? loans.find((l) => l.id === activeId) : null;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const loanId = active.id as string;
    const loan = loans.find((l) => l.id === loanId);
    if (!loan || !canDragLoan(loan)) return;

    const targetColumn = parseStageFromDroppableId(over.id as string);
    if (!targetColumn) return;

    const targetStatus = getEntryStatusForColumn(targetColumn);
    if (!targetStatus || targetStatus === loan.status) return;

    const currentColumn = getColumnIdForLoanStatus(loan.status);
    if (currentColumn === targetColumn) return;

    try {
      await transitionStatus.mutateAsync({ loanId, toStatus: targetStatus });
    } catch {
      // useTransitionLoanStatus already shows error toast
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading pipeline…
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pipelineCollision}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stageId={stage.id}
            title={stage.label}
            loans={grouped.get(stage.id) ?? []}
            loanCountLabel={String((grouped.get(stage.id) ?? []).length)}
            allowDrop={canUpdate}
            canUpdate={canUpdate}
            canDragLoan={canDragLoan}
            isExternalManaged={isExternalManaged}
          />
        ))}
        <PipelineColumn
          stageId={OTHER_COLUMN_ID}
          title="Other"
          loans={grouped.get(OTHER_COLUMN_ID) ?? []}
          loanCountLabel={String((grouped.get(OTHER_COLUMN_ID) ?? []).length)}
          allowDrop={false}
          canUpdate={canUpdate}
          canDragLoan={canDragLoan}
          isExternalManaged={isExternalManaged}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLoan ? (
          <div className="w-[260px] rotate-1 opacity-95 shadow-lg">
            <LoanPipelineCard loan={activeLoan} canDrag={false} showRawStatus={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
