import {
  useLoanConditions,
  useCreateLoanCondition,
  useUpdateLoanCondition,
  useConditionAssigneeProfiles,
  type LoanCondition,
} from "@/hooks/useLoanConditions";
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
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Lock,
  User,
  Building2,
  FileText,
  CalendarClock,
} from "lucide-react";
import { useState, useMemo } from "react";

const TERMINAL_STATUSES = ["closed", "cancelled", "withdrawn"];

const CONDITION_STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }
> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  received: { label: "Received", variant: "outline", icon: AlertCircle },
  cleared: { label: "Cleared", variant: "default", icon: CheckCircle2 },
  waived: { label: "Waived", variant: "outline", icon: XCircle },
  expired: { label: "Expired", variant: "destructive", icon: XCircle },
};

const CONDITION_TYPES = [
  { value: "PTD", label: "Prior-to-Docs (PTD)" },
  { value: "PTF", label: "Prior-to-Fund (PTF)" },
  { value: "PTC", label: "Prior-to-Close (PTC)" },
];

const ASSIGNED_PARTY_OPTIONS = [
  { value: "", label: "Auto (from rules)" },
  { value: "borrower", label: "Borrower" },
  { value: "processor", label: "Processor" },
  { value: "title", label: "Title Company" },
  { value: "loan_officer", label: "Loan Officer" },
  { value: "internal", label: "Internal" },
];

const PARTY_LABELS: Record<string, { label: string; icon: typeof User }> = {
  borrower: { label: "Borrower", icon: User },
  processor: { label: "Processor", icon: FileText },
  title: { label: "Title", icon: Building2 },
  loan_officer: { label: "LO", icon: User },
  internal: { label: "Internal", icon: Building2 },
};

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let text: string;
  let className: string;

  if (diffDays < 0) {
    text = `${Math.abs(diffDays)}d overdue`;
    className = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-100";
  } else if (diffDays === 0) {
    text = "Due today";
    className = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-100";
  } else if (diffDays <= 2) {
    text = `${diffDays}d left`;
    className = "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100";
  } else if (diffDays <= 5) {
    text = `${diffDays}d left`;
    className = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-100";
  } else {
    text = `${diffDays}d left`;
    className = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`text-[10px] font-medium ${className}`}>
            <CalendarClock className="mr-1 h-3 w-3" />
            {text}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Due {dueDate}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AssigneeCell({
  condition,
  profiles,
}: {
  condition: LoanCondition;
  profiles: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }>;
}) {
  const party = condition.assigned_party;
  if (!party) return <span className="text-muted-foreground text-xs">—</span>;

  const partyInfo = PARTY_LABELS[party] || { label: party, icon: User };
  const Icon = partyInfo.icon;

  if (condition.assigned_to_user_id && profiles[condition.assigned_to_user_id]) {
    const prof = profiles[condition.assigned_to_user_id];
    const name = prof.full_name || prof.email || "Unknown";
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={prof.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-xs truncate max-w-[80px]">{name}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{partyInfo.label}: {name}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Icon className="h-3 w-3" />
            {partyInfo.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Assigned to: {partyInfo.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ConditionTrackerProps {
  loanId: string;
  loanStatus?: string;
}

export function ConditionTracker({ loanId, loanStatus }: ConditionTrackerProps) {
  const { data: conditions, isLoading } = useLoanConditions(loanId);
  const createCondition = useCreateLoanCondition();
  const updateCondition = useUpdateLoanCondition();
  const { hasPermission } = useEffectivePermissions();
  const isTerminal = !!loanStatus && TERMINAL_STATUSES.includes(loanStatus);
  const canCreate = hasPermission("loans:update") && !isTerminal;

  const [open, setOpen] = useState(false);
  const [conditionType, setConditionType] = useState("PTD");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [assignedParty, setAssignedParty] = useState("");
  const [filterParty, setFilterParty] = useState<string>("all");

  const assigneeIds = useMemo(
    () => (conditions ?? []).map((c) => c.assigned_to_user_id).filter(Boolean) as string[],
    [conditions],
  );
  const { data: profiles } = useConditionAssigneeProfiles(assigneeIds);

  const handleCreate = () => {
    if (!description.trim()) return;
    createCondition.mutate(
      {
        loan_id: loanId,
        condition_type: conditionType,
        description: description.trim(),
        category: category.trim() || null,
        assigned_party: assignedParty || null,
      },
      {
        onSuccess: () => {
          setDescription("");
          setCategory("");
          setConditionType("PTD");
          setAssignedParty("");
          setOpen(false);
        },
      },
    );
  };

  const handleStatusChange = (conditionId: string, newStatus: string) => {
    updateCondition.mutate({
      id: conditionId,
      loanId,
      data: {
        status: newStatus,
        ...(newStatus === "received" ? { received_at: new Date().toISOString() } : {}),
      },
    });
  };

  const filteredConditions = useMemo(() => {
    if (filterParty === "all") return conditions ?? [];
    return (conditions ?? []).filter((c) => c.assigned_party === filterParty);
  }, [conditions, filterParty]);

  const grouped = {
    PTD: filteredConditions.filter((c) => c.condition_type === "PTD"),
    PTF: filteredConditions.filter((c) => c.condition_type === "PTF"),
    PTC: filteredConditions.filter((c) => c.condition_type === "PTC"),
  };

  const allConditions = conditions ?? [];
  const totalPending = allConditions.filter((c) => c.status === "pending").length;
  const totalReceived = allConditions.filter((c) => c.status === "received").length;
  const totalCleared = allConditions.filter((c) => c.status === "cleared" || c.status === "waived").length;
  const total = allConditions.length;

  const overdue = allConditions.filter((c) => {
    if (!c.due_date || c.status === "cleared" || c.status === "waived" || c.status === "expired") return false;
    const due = new Date(c.due_date + "T00:00:00");
    return due < new Date(new Date().toISOString().split("T")[0] + "T00:00:00");
  }).length;

  const activeParties = [...new Set(allConditions.map((c) => c.assigned_party).filter(Boolean))];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Conditions</CardTitle>
          <CardDescription>
            {total > 0 ? (
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                <span>{totalCleared}/{total} cleared</span>
                <span>{totalPending} pending</span>
                {totalReceived > 0 && <span>{totalReceived} received</span>}
                {overdue > 0 && (
                  <span className="text-red-600 dark:text-red-400 font-medium">{overdue} overdue</span>
                )}
              </span>
            ) : (
              "Underwriting conditions (PTD / PTF / PTC)"
            )}
          </CardDescription>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add Condition
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Condition</DialogTitle>
                <DialogDescription>
                  Add a new underwriting condition. Assignment and due date are auto-set based on workflow rules.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <SearchableSelect
                  value={conditionType}
                  onChange={setConditionType}
                  options={CONDITION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                />
                <Input
                  placeholder="Category (e.g. Income, Assets, Title)"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <Textarea
                  placeholder="Condition description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Assign to</label>
                  <SearchableSelect
                    value={assignedParty}
                    onChange={setAssignedParty}
                    options={ASSIGNED_PARTY_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave as "Auto" to let workflow rules decide based on type + category.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!description.trim() || createCondition.isPending}
                >
                  {createCondition.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
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
            Conditions are locked for {loanStatus} loans.
          </div>
        )}

        {/* Filter by assigned party */}
        {activeParties.length > 0 && total > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Badge
              variant={filterParty === "all" ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setFilterParty("all")}
            >
              All ({total})
            </Badge>
            {activeParties.map((party) => {
              const count = allConditions.filter((c) => c.assigned_party === party).length;
              const info = PARTY_LABELS[party!] || { label: party, icon: User };
              return (
                <Badge
                  key={party}
                  variant={filterParty === party ? "default" : "outline"}
                  className="cursor-pointer text-xs gap-1"
                  onClick={() => setFilterParty(party!)}
                >
                  {info.label} ({count})
                </Badge>
              );
            })}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No conditions recorded.
          </p>
        ) : (
          <div className="space-y-6">
            {(["PTD", "PTF", "PTC"] as const).map((type) => {
              const items = grouped[type];
              if (items.length === 0) return null;
              return (
                <div key={type}>
                  <h4 className="mb-2 text-sm font-semibold">
                    {CONDITION_TYPES.find((t) => t.value === type)?.label ?? type}
                    <Badge variant="outline" className="ml-2">
                      {items.length}
                    </Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[90px]">Category</TableHead>
                        <TableHead className="w-[100px]">Assignee</TableHead>
                        <TableHead className="w-[100px]">Due</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        {canCreate && (
                          <TableHead className="w-[130px] text-right">Action</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((c) => {
                        const st =
                          CONDITION_STATUS_MAP[c.status] ?? CONDITION_STATUS_MAP.pending;
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2">
                                {c.priority === "urgent" && (
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-100 text-[9px] shrink-0">
                                    URGENT
                                  </Badge>
                                )}
                                <span>{c.description}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {c.category ?? "—"}
                            </TableCell>
                            <TableCell>
                              <AssigneeCell
                                condition={c}
                                profiles={profiles ?? {}}
                              />
                            </TableCell>
                            <TableCell>
                              {c.status !== "cleared" &&
                              c.status !== "waived" &&
                              c.status !== "expired" ? (
                                <DueDateBadge dueDate={c.due_date} />
                              ) : c.due_date ? (
                                <span className="text-xs text-muted-foreground">
                                  {c.due_date}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <Badge variant={st.variant}>{st.label}</Badge>
                            </TableCell>
                            {canCreate && (
                              <TableCell className="text-right">
                                {c.status === "pending" && (
                                  <SearchableSelect
                                    onChange={(v) => handleStatusChange(c.id, v)}
                                    className="h-8 w-[110px]"
                                    placeholder="Update"
                                    options={[
                                      { value: "received", label: "Received" },
                                      { value: "cleared", label: "Cleared" },
                                      { value: "waived", label: "Waived" },
                                    ]}
                                  />
                                )}
                                {c.status === "received" && (
                                  <SearchableSelect
                                    onChange={(v) => handleStatusChange(c.id, v)}
                                    className="h-8 w-[110px]"
                                    placeholder="Update"
                                    options={[
                                      { value: "cleared", label: "Cleared" },
                                      { value: "expired", label: "Expired" },
                                      { value: "waived", label: "Waived" },
                                    ]}
                                  />
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
