import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  useActionItems,
  useActionItemCounts,
  useCompleteActionItem,
  useCreateActionItem,
  useUpdateActionItem,
  useDeleteActionItem,
  useAssignableUsers,
  useTaskComments,
  useAddTaskComment,
  useUpdateActionItemStatus,
  type ActionItemStatus,
  type ActionView,
  type ActionItem,
} from "@/hooks/useActionItems";
import { useAgentEnabled, ACTION_ITEMS_AGENT_SLUG } from "@/hooks/useAgentEnabled";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Users,
  RefreshCw,
  Plus,
  Loader2,
  Banknote,
  Bot,
  ShieldAlert,
  ListTodo,
  MessageSquare,
  MoreVertical,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/cache";

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", label: "High" },
  normal: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Normal" },
  low: { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "Low" },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  in_progress: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "In Progress" },
  not_started: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", label: "Not Started" },
  blocked: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", label: "Blocked" },
  on_hold: { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "On Hold" },
  completed: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Completed" },
  cancelled: { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "Cancelled" },
};

function ActionItemRow({
  item,
  onComplete,
  isCompleting,
  showAssignee,
  onOpen,
  canEdit,
  onEdit,
  onDelete,
}: {
  item: ActionItem;
  onComplete: (id: string) => void;
  isCompleting: boolean;
  showAssignee?: boolean;
  onOpen?: (item: ActionItem) => void;
  canEdit?: boolean;
  onEdit?: (item: ActionItem) => void;
  onDelete?: (item: ActionItem) => void;
}) {
  const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== "completed";
  const p = priorityConfig[item.priority] ?? priorityConfig.normal;
  const s = statusConfig[item.status] ?? statusConfig.not_started;

  const isCompleted = item.status === "completed";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50 ${
        isOverdue ? "border-destructive/30 bg-destructive/5" : ""
      }`}
      onClick={() => onOpen?.(item)}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <label
              className="flex shrink-0 cursor-pointer items-center justify-center mt-0.5 text-muted-foreground transition-colors hover:text-primary has-[:disabled]:cursor-default has-[:disabled]:opacity-70"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isCompleted}
                disabled={isCompleted || isCompleting}
                onChange={() => {
                  if (!isCompleted && !isCompleting) onComplete(item.id);
                }}
                className="sr-only"
                aria-label="Mark as complete"
              />
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 shrink-0" aria-hidden />
              )}
            </label>
          </TooltipTrigger>
          <TooltipContent>{isCompleted ? "Completed" : "Mark as complete"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`text-left text-sm font-medium hover:underline ${
              isCompleted ? "line-through text-muted-foreground" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(item);
            }}
          >
            {item.title}
          </button>
          <Badge className={`text-xs ${p.color}`} variant="outline">
            {p.label}
          </Badge>
          <Badge className={`text-xs ${s.color}`} variant="outline">
            {s.label}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-xs">
              Overdue
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {item.loan && (
            <Link
              to={`/loans/${item.loan_id}`}
              className="flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Banknote className="h-3 w-3" />
              {(item.loan as any)?.loan_number}
            </Link>
          )}
          {item.start_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Start {new Date(item.start_date).toLocaleDateString()}
            </span>
          )}
          {item.due_date && (
            <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
              <Calendar className="h-3 w-3" />
              Due {new Date(item.due_date).toLocaleDateString()}
            </span>
          )}
          {item.source === "agent" && (
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              AI Generated
            </span>
          )}
          {showAssignee && item.assigned_to && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {(item.assigned_to as any)?.full_name || "Unknown"}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.(item);
          }}
        >
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </Button>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(item);
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(item);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function EmptyState({ view }: { view: ActionView }) {
  const messages: Record<ActionView, string> = {
    daily: "No action items for today. You're all caught up!",
    weekly: "No action items this week.",
    overdue: "No overdue items. Great job staying on track!",
    delegated: "No delegated tasks. Items you assign to others appear here.",
    all: "No action items found.",
    completed: "No completed tasks yet. Complete a task to see it here.",
    ai_generated: "No AI-generated tasks. Use Generate to create action items from your pipeline.",
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <ListTodo className="h-12 w-12 text-muted-foreground/30" />
      <p className="mt-3 text-sm text-muted-foreground">{messages[view]}</p>
    </div>
  );
}

function ActionItemList({
  view,
  currentUserId,
  onEditRequest,
  onDeleteRequest,
}: {
  view: ActionView;
  currentUserId?: string;
  onEditRequest: (item: ActionItem) => void;
  onDeleteRequest: (item: ActionItem) => void;
}) {
  const sourceView: ActionView =
    view === "daily" ? "weekly" : view;
  const { data: items, isLoading } = useActionItems(sourceView);
  const completeMutation = useCompleteActionItem();
  const [selected, setSelected] = useState<ActionItem | null>(null);
  const statusMutation = useUpdateActionItemStatus();
  const commentsQuery = useTaskComments(selected?.id ?? null);
  const addCommentMutation = useAddTaskComment();
  const [commentText, setCommentText] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return <EmptyState view={view} />;
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((item) => (
          <ActionItemRow
            key={item.id}
            item={item}
            onComplete={(id) => completeMutation.mutate(id)}
            isCompleting={completeMutation.isPending}
            showAssignee={view === "delegated"}
            onOpen={(it) => setSelected(it)}
            canEdit={!!currentUserId && item.created_by_user_id === currentUserId}
            onEdit={(it) => {
              setSelected(null);
              onEditRequest(it);
            }}
            onDelete={(it) => {
              setSelected(null);
              onDeleteRequest(it);
            }}
          />
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Action Item</DialogTitle>
            <DialogDescription>Details and comments.</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)]">
              <div className="space-y-5">
                <div className="space-y-1">
                  <div className="text-base font-semibold">{selected.title}</div>
                  {selected.description && (
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selected.description}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">Start Date</div>
                    <div>
                      {selected.start_date ? new Date(selected.start_date).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">Due Date</div>
                    <div>
                      {selected.due_date ? new Date(selected.due_date).toLocaleDateString() : "—"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <SearchableSelect
                    value={(selected.status as ActionItemStatus) ?? "not_started"}
                    onChange={(value) => {
                      const next = value as ActionItemStatus;
                      statusMutation.mutate(
                        { itemId: selected.id, status: next },
                        {
                          onSuccess: () =>
                            setSelected((prev) => (prev ? { ...prev, status: next } : prev)),
                        },
                      );
                    }}
                    options={[
                      { value: "not_started", label: "Not Started" },
                      { value: "in_progress", label: "In Progress" },
                      { value: "blocked", label: "Blocked" },
                      { value: "on_hold", label: "On Hold" },
                      { value: "completed", label: "Completed" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Comments</div>
                  {commentsQuery.isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                <div className="space-y-3 max-h-72 overflow-auto rounded-md border p-3 bg-background/60">
                  {(commentsQuery.data ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No comments yet.</div>
                  ) : (
                    (commentsQuery.data ?? []).map((c) => (
                      <div key={c.comment_id} className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {(c.user as any)?.full_name || (c.user as any)?.email || "Unknown"} —{" "}
                          {new Date(c.created_at).toLocaleString()}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{c.comment_text}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Add comment</Label>
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment or update…"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!selected || !commentText.trim() || addCommentMutation.isPending) return;
                        addCommentMutation.mutate(
                          { taskId: selected.id, text: commentText },
                          { onSuccess: () => setCommentText("") },
                        );
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        if (!selected) return;
                        addCommentMutation.mutate(
                          { taskId: selected.id, text: commentText },
                          { onSuccess: () => setCommentText("") },
                        );
                      }}
                      disabled={!commentText.trim() || addCommentMutation.isPending}
                    >
                      {addCommentMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ActionItems() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isEnabled, isLoading: agentLoading } = useAgentEnabled(ACTION_ITEMS_AGENT_SLUG);
  const { data: counts } = useActionItemCounts();
  const [generating, setGenerating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const createMutation = useCreateActionItem();
  const { data: assignableUsers = [], isLoading: assignableLoading } = useAssignableUsers();

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [newStatus, setNewStatus] = useState<ActionItemStatus>("not_started");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState<string>("");
  const [newWatchers, setNewWatchers] = useState<string[]>([]);
  const [watchersOpen, setWatchersOpen] = useState(false);

  const updateMutation = useUpdateActionItem();
  const deleteMutation = useDeleteActionItem();

  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("normal");
  const [editStatus, setEditStatus] = useState<ActionItemStatus>("not_started");
  const [editStartDate, setEditStartDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState<string>("");
  const [editWatchers, setEditWatchers] = useState<string[]>([]);
  const [editWatchersOpen, setEditWatchersOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ActionItem | null>(null);
  const validViews: ActionView[] = ["daily", "weekly", "overdue", "delegated", "all", "completed", "ai_generated"];
  const urlView = searchParams.get("view");
  const [activeView, setActiveView] = useState<ActionView>(
    validViews.includes(urlView as ActionView) ? (urlView as ActionView) : "daily"
  );

  if (agentLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Action Items Agent is Disabled</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The Action Items Agent must be enabled in Admin → Agents before this
          dashboard is available. Contact your administrator.
        </p>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("generate-daily-actions", {
        body: { user_id: user.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) {
        const msg =
          error.message?.includes("Failed to fetch") || error.message?.includes("404")
            ? "Edge function generate-daily-actions is not deployed. Deploy it from the repo (supabase/functions/generate-daily-actions) in Lovable."
            : error.message;
        throw new Error(msg);
      }
      toast.success(typeof data?.message === "string" ? data.message : "Action items generated");
      await queryClient.invalidateQueries({ queryKey: queryKeys.actionItems.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate action items");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    if (newStartDate && newDueDate) {
      const start = new Date(newStartDate);
      const due = new Date(newDueDate);
      if (start > due) {
        toast.error("Start Date must be on or before Due Date");
        return;
      }
    }

    const assignedTo = newAssignedTo || user?.id;
    const watchers = Array.from(new Set([user?.id, assignedTo, ...newWatchers].filter(Boolean))) as string[];
    createMutation.mutate(
      {
        title: newTitle,
        description: newDescription || undefined,
        priority: newPriority,
        status: newStatus,
        start_date: newStartDate || undefined,
        due_date: newDueDate || undefined,
        assigned_to_user_id: assignedTo || undefined,
        watchers,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewTitle("");
          setNewPriority("normal");
          setNewStatus("not_started");
          setNewStartDate("");
          setNewDueDate("");
          setNewDescription("");
          setNewAssignedTo("");
          setNewWatchers([]);
        },
      },
    );
  };

  const openEditDialog = (item: ActionItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditPriority(item.priority || "normal");
    setEditStatus((item.status as ActionItemStatus) || "not_started");
    setEditStartDate(item.start_date || "");
    setEditDueDate(item.due_date || "");
    setEditDescription(item.description || "");
    setEditAssignedTo(item.assigned_to_user_id);
    setEditWatchers(item.watchers || []);
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingItem) return;

    if (editStartDate && editDueDate) {
      const start = new Date(editStartDate);
      const due = new Date(editDueDate);
      if (start > due) {
        toast.error("Start Date must be on or before Due Date");
        return;
      }
    }

    const creatorId = editingItem.created_by_user_id || user?.id;
    const assignedTo = editAssignedTo || creatorId || user?.id;
    const watchers = Array.from(
      new Set(
        [creatorId, assignedTo, ...(editWatchers ?? [])].filter(Boolean) as string[],
      ),
    );

    updateMutation.mutate(
      {
        itemId: editingItem.id,
        updates: {
          title: editTitle,
          description: editDescription || null,
          start_date: editStartDate || null,
          due_date: editDueDate || null,
          priority: editPriority,
          status: editStatus,
          assigned_to_user_id: assignedTo || undefined,
          watchers,
        },
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          setEditingItem(null);
        },
      },
    );
  };

  const openDeleteDialog = (item: ActionItem) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingItem) return;
    deleteMutation.mutate(deletingItem.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        // Close any edit dialog that might be open for this item.
        if (editingItem && editingItem.id === deletingItem.id) {
          setEditOpen(false);
          setEditingItem(null);
        }
        setDeletingItem(null);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ListTodo className="h-7 w-7" />
              Action Items
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-generated and manually assigned tasks from your mortgage pipeline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Generate
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts?.daily ?? 0}</p>
            <p className="text-xs text-muted-foreground">Active items assigned to you</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{counts?.overdue ?? 0}</p>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Delegated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts?.delegated ?? 0}</p>
            <p className="text-xs text-muted-foreground">Assigned to others by you</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeView}
        onValueChange={(value) => {
          const next = validViews.includes(value as ActionView) ? (value as ActionView) : "daily";
          setActiveView(next);
          setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("view", next);
            return params;
          }, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="daily" className="gap-1">
            <Calendar className="h-4 w-4" />
            Daily
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1">
            <Clock className="h-4 w-4" />
            Weekly
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1">
            <AlertTriangle className="h-4 w-4" />
            Overdue
            {(counts?.overdue ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-xs">
                {counts?.overdue}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="delegated" className="gap-1">
            <Users className="h-4 w-4" />
            Delegated
            {(counts?.delegated ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-xs">
                {counts?.delegated}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai_generated" className="gap-1">
            <Bot className="h-4 w-4" />
            AI Generated
            {(counts?.ai_generated ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-xs">
                {counts?.ai_generated}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1">
            <ListTodo className="h-4 w-4" />
            All
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Completed
            {(counts?.completed ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-xs">
                {counts?.completed}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardContent className="p-4">
            <TabsContent value="daily" className="mt-0">
              <ActionItemList
                view="daily"
                currentUserId={user?.id}
                onEditRequest={openEditDialog}
                onDeleteRequest={openDeleteDialog}
              />
            </TabsContent>
            <TabsContent value="weekly" className="mt-0">
              <ActionItemList
                view="weekly"
                currentUserId={user?.id}
                onEditRequest={openEditDialog}
                onDeleteRequest={openDeleteDialog}
              />
            </TabsContent>
            <TabsContent value="overdue" className="mt-0">
              <ActionItemList
                view="overdue"
                currentUserId={user?.id}
                onEditRequest={openEditDialog}
                onDeleteRequest={openDeleteDialog}
              />
            </TabsContent>
            <TabsContent value="delegated" className="mt-0">
              <ActionItemList
                view="delegated"
                currentUserId={user?.id}
                onEditRequest={openEditDialog}
                onDeleteRequest={openDeleteDialog}
              />
            </TabsContent>
            <TabsContent value="ai_generated" className="mt-0">
              <ActionItemList
                view="ai_generated"
                currentUserId={user?.id}
                onEditRequest={openEditDialog}
                onDeleteRequest={openDeleteDialog}
              />
            </TabsContent>
            <TabsContent value="all" className="mt-0">
              <ActionItemList
                view="all"
                currentUserId={user?.id}
                onEditRequest={openEditDialog}
                onDeleteRequest={openDeleteDialog}
              />
            </TabsContent>
            <TabsContent value="completed" className="mt-0">
              <ActionItemList
                view="completed"
                currentUserId={user?.id}
                onEditRequest={openEditDialog}
                onDeleteRequest={openDeleteDialog}
              />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Action Item</DialogTitle>
            <DialogDescription>Create a task, assign it, and keep people in the loop.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Follow up on client documents"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description / Notes</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Add context, requirements, links, or notes (optional)"
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <SearchableSelect
                  value={newPriority}
                  onChange={setNewPriority}
                  options={[
                    { value: "high", label: "High" },
                    { value: "normal", label: "Normal" },
                    { value: "low", label: "Low" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <SearchableSelect
                  value={newStatus}
                  onChange={(v) => setNewStatus(v as ActionItemStatus)}
                  options={[
                    { value: "not_started", label: "Not Started" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "blocked", label: "Blocked" },
                    { value: "on_hold", label: "On Hold" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assigned To</Label>
              <SearchableSelect
                value={newAssignedTo || user?.id || ""}
                onChange={(value) => {
                  setNewAssignedTo(value);
                  const nextWatchers = new Set([...(newWatchers ?? []), value, user?.id].filter(Boolean) as string[]);
                  setNewWatchers(Array.from(nextWatchers));
                }}
                disabled={assignableLoading || assignableUsers.length === 0}
                placeholder={assignableLoading ? "Loading…" : "Select user"}
                options={assignableUsers.map((u) => ({
                  value: u.id,
                  label: u.full_name || u.email || u.id,
                }))}
              />
              <p className="text-xs text-muted-foreground">Creator is auto-assigned by default.</p>
            </div>

            <div className="space-y-2">
              <Label>People in the Loop</Label>
              <Popover open={watchersOpen} onOpenChange={setWatchersOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {newWatchers.length > 0 ? `${newWatchers.length} selected` : "Select people"}
                    <Users className="ml-2 h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-3">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Creator and assignee are included automatically.
                    </div>
                    <div className="max-h-56 overflow-auto space-y-2">
                      {assignableUsers.map((u) => {
                        const fixedIds = new Set([user?.id, (newAssignedTo || user?.id) ?? ""].filter(Boolean) as string[]);
                        const isFixed = fixedIds.has(u.id);
                        const checked = isFixed || newWatchers.includes(u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={checked}
                              disabled={isFixed}
                              onCheckedChange={(v) => {
                                if (isFixed) return;
                                setNewWatchers((prev) => {
                                  const set = new Set(prev);
                                  if (v === true) set.add(u.id);
                                  else set.delete(u.id);
                                  return Array.from(set);
                                });
                              }}
                            />
                            <span className="min-w-0 truncate">{u.full_name || u.email || u.id}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) {
          setEditingItem(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Action Item</DialogTitle>
            <DialogDescription>Update task details, dates, status, and people in the loop.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description / Notes</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Update context, requirements, links, or notes"
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <SearchableSelect
                  value={editPriority}
                  onChange={setEditPriority}
                  options={[
                    { value: "high", label: "High" },
                    { value: "normal", label: "Normal" },
                    { value: "low", label: "Low" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <SearchableSelect
                  value={editStatus}
                  onChange={(v) => setEditStatus(v as ActionItemStatus)}
                  options={[
                    { value: "not_started", label: "Not Started" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "blocked", label: "Blocked" },
                    { value: "on_hold", label: "On Hold" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assigned To</Label>
              <SearchableSelect
                value={editAssignedTo || user?.id || ""}
                onChange={(value) => {
                  setEditAssignedTo(value);
                  const nextWatchers = new Set([...(editWatchers ?? []), value, user?.id].filter(Boolean) as string[]);
                  setEditWatchers(Array.from(nextWatchers));
                }}
                disabled={assignableLoading || assignableUsers.length === 0}
                placeholder={assignableLoading ? "Loading…" : "Select user"}
                options={assignableUsers.map((u) => ({
                  value: u.id,
                  label: u.full_name || u.email || u.id,
                }))}
              />
              <p className="text-xs text-muted-foreground">Creator and assignee stay in the loop automatically.</p>
            </div>

            <div className="space-y-2">
              <Label>People in the Loop</Label>
              <Popover open={editWatchersOpen} onOpenChange={setEditWatchersOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {editWatchers.length > 0 ? `${editWatchers.length} selected` : "Select people"}
                    <Users className="ml-2 h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-3">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Creator and assignee are always included automatically.
                    </div>
                    <div className="max-h-56 overflow-auto space-y-2">
                      {assignableUsers.map((u) => {
                        const creatorId = editingItem?.created_by_user_id || user?.id || "";
                        const assigneeId = editAssignedTo || creatorId;
                        const fixedIds = new Set([creatorId, assigneeId].filter(Boolean));
                        const isFixed = fixedIds.has(u.id);
                        const checked = isFixed || editWatchers.includes(u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={checked}
                              disabled={isFixed}
                              onCheckedChange={(v) => {
                                if (isFixed) return;
                                setEditWatchers((prev) => {
                                  const set = new Set(prev);
                                  if (v === true) set.add(u.id);
                                  else set.delete(u.id);
                                  return Array.from(set);
                                });
                              }}
                            />
                            <span className="min-w-0 truncate">{u.full_name || u.email || u.id}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!editTitle.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={(open) => {
        setDeleteOpen(open);
        if (!open) {
          setDeletingItem(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
