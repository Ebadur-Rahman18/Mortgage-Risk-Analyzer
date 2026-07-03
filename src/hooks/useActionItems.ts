import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import { logCrud } from "@/lib/activity-logger";

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  assigned_to_user_id: string;
  assigned_by_user_id: string | null;
  created_by_user_id: string | null;
  watchers: string[];
  loan_id: string | null;
  agent_id: string | null;
  source: string;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  loan?: { loan_number: string } | null;
  assigned_to?: { full_name: string | null; email: string | null } | null;
  assigned_by?: { full_name: string | null; email: string | null } | null;
}

export type ActionView = "daily" | "weekly" | "overdue" | "delegated" | "all" | "completed" | "ai_generated";

export type ActionItemStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed"
  | "on_hold"
  | "cancelled";

export interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
  branch_id?: string | null;
  custom_role_slug?: string | null;
  app_role?: string | null;
}

function buildClientDedupeKey(item: ActionItem): string {
  const normalizedTitle = (item.title ?? "")
    .toLowerCase()
    // Strip digits so day-specific phrases don't break grouping
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const loanId = item.loan_id ?? "";
  const source = item.source ?? "";
  return `${source}|${loanId}|${normalizedTitle}`;
}

function dedupeAgentItems(view: ActionView, items: ActionItem[]): ActionItem[] {
  if (!items.length) return items;

  const result = [...items];

  // Client-side safety net: collapse duplicate AI-generated tasks that differ
  // only by dynamic text (e.g. "expired 12 days ago" vs "17 days ago").
  const bestAgentByKey = new Map<string, ActionItem>();

  for (const item of items) {
    if (item.source !== "agent") continue;
    const key = buildClientDedupeKey(item);
    const existing = bestAgentByKey.get(key);
    if (!existing) {
      bestAgentByKey.set(key, item);
      continue;
    }

    const existingTs = new Date(existing.updated_at || existing.created_at).getTime();
    const currentTs = new Date(item.updated_at || item.created_at).getTime();
    if (currentTs > existingTs) {
      bestAgentByKey.set(key, item);
    }
  }

  if (bestAgentByKey.size === 0) {
    return result;
  }

  const filtered: ActionItem[] = [];
  for (const item of result) {
    if (item.source !== "agent") {
      filtered.push(item);
      continue;
    }
    const key = buildClientDedupeKey(item);
    const best = bestAgentByKey.get(key);
    if (best && best.id === item.id) {
      filtered.push(item);
    }
  }

  return filtered;
}

function getDateRange(view: ActionView): { from?: string; to?: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().split("T")[0];

  if (view === "daily") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { from: todayStr, to: tomorrow.toISOString().split("T")[0] };
  }

  if (view === "weekly") {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return { to: weekEnd.toISOString().split("T")[0] };
  }

  if (view === "overdue") {
    return { to: todayStr };
  }

  return {};
}

export function useActionItems(view: ActionView) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.actionItems.byView(view),
    queryFn: async (): Promise<ActionItem[]> => {
      if (!user) return [];

      const selectFields = "*, loan:loans(loan_number)";

      if (view === "delegated") {
        const { data, error } = await supabase
          .from("action_items")
          .select(selectFields)
          .eq("assigned_by_user_id", user.id)
          .neq("assigned_to_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        const items = (data ?? []) as unknown as ActionItem[];

        const userIds = [...new Set(items.map((i) => i.assigned_to_user_id))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds);
          const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
          for (const item of items) {
            (item as any).assigned_to = profileMap.get(item.assigned_to_user_id) ?? null;
          }
        }
        return items;
      }

      // Completed: only completed tasks, ordered by completed_at desc
      if (view === "completed") {
        const { data, error } = await supabase
          .from("action_items")
          .select(selectFields)
          .eq("assigned_to_user_id", user.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        const items = (data ?? []) as unknown as ActionItem[];
        return dedupeAgentItems(view, items);
      }

      // AI Generated: only agent-created tasks (all statuses), assigned to user
      if (view === "ai_generated") {
        const { data, error } = await supabase
          .from("action_items")
          .select(selectFields)
          .eq("assigned_to_user_id", user.id)
          .eq("source", "agent")
          .order("due_date", { ascending: true })
          .order("priority", { ascending: true })
          .limit(100);
        if (error) throw error;
        const items = (data ?? []) as unknown as ActionItem[];
        return dedupeAgentItems(view, items);
      }

      let query = supabase
        .from("action_items")
        .select(selectFields)
        .eq("assigned_to_user_id", user.id)
        .in("status", ["not_started", "in_progress", "blocked", "on_hold"]);

      const range = getDateRange(view);

      if (view === "weekly" && range.to) {
        // Show tasks that are in play this week:
        // - no due date
        // - OR due date this week
        // - OR start date this week or earlier
        query = query.or(`due_date.is.null,due_date.lt.${range.to},start_date.lt.${range.to}`);
      } else if (view === "overdue" && range.to) {
        query = query.not("due_date", "is", null).lt("due_date", range.to);
      }

      if (view === "daily" || view === "overdue") {
        query = query.order("priority", { ascending: true }).order("due_date", { ascending: true });
      } else {
        query = query.order("due_date", { ascending: true }).order("priority", { ascending: true });
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      const items = (data ?? []) as unknown as ActionItem[];
      return dedupeAgentItems(view, items);
    },
    enabled: !!user,
  });
}

export function useActionItemCounts() {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: [...queryKeys.actionItems.all, "counts"],
    queryFn: async () => {
      if (!user) return { daily: 0, overdue: 0, delegated: 0, completed: 0, ai_generated: 0 };

      const [dailyRes, overdueRes, delegatedRes, completedRes, aiGeneratedRes] = await Promise.all([
        supabase
          .from("action_items")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to_user_id", user.id)
          .in("status", ["not_started", "in_progress", "blocked", "on_hold"]),
        supabase
          .from("action_items")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to_user_id", user.id)
          .in("status", ["not_started", "in_progress", "blocked", "on_hold"])
          .not("due_date", "is", null)
          .lt("due_date", today),
        supabase
          .from("action_items")
          .select("id", { count: "exact", head: true })
          .eq("assigned_by_user_id", user.id)
          .neq("assigned_to_user_id", user.id),
        supabase
          .from("action_items")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to_user_id", user.id)
          .eq("status", "completed"),
        supabase
          .from("action_items")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to_user_id", user.id)
          .eq("source", "agent"),
      ]);

      return {
        daily: dailyRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        delegated: delegatedRes.count ?? 0,
        completed: completedRes.count ?? 0,
        ai_generated: aiGeneratedRes.count ?? 0,
      };
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });
}

export function useCompleteActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("action_items")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
      return itemId;
    },
    onSuccess: (itemId) => {
      invalidateKeys.actionItems(queryClient);
      logCrud("update", "action_item", itemId, { status: "completed" });
      toast.success("Action item completed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to complete item");
    },
  });
}

export function useReassignActionItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, newUserId }: { itemId: string; newUserId: string }) => {
      const { error } = await supabase
        .from("action_items")
        .update({
          assigned_to_user_id: newUserId,
          assigned_by_user_id: user?.id ?? null,
        })
        .eq("id", itemId);
      if (error) throw error;
      return { itemId, newUserId };
    },
    onSuccess: ({ itemId, newUserId }) => {
      invalidateKeys.actionItems(queryClient);
      logCrud("update", "action_item", itemId, { assigned_to_user_id: newUserId });
      toast.success("Action item reassigned");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reassign");
    },
  });
}

export function useCreateActionItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      description?: string;
      start_date?: string;
      assigned_to_user_id?: string;
      watchers?: string[];
      loan_id?: string;
      priority?: string;
      due_date?: string;
      status?: ActionItemStatus;
      source?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const assignedTo = params.assigned_to_user_id || user.id;
      const watchers = Array.from(new Set([user.id, assignedTo, ...(params.watchers ?? [])]));

      if (params.start_date && params.due_date) {
        const start = new Date(params.start_date);
        const due = new Date(params.due_date);
        if (start > due) {
          throw new Error("Start Date must be on or before Due Date");
        }
      }

      const { data, error } = await supabase.from("action_items").insert({
        title: params.title,
        description: params.description,
        start_date: params.start_date,
        due_date: params.due_date,
        status: params.status ?? "not_started",
        priority: params.priority,
        loan_id: params.loan_id,
        source: params.source || "manual",
        watchers,
        created_by_user_id: user.id,
        assigned_to_user_id: assignedTo,
        assigned_by_user_id: assignedTo !== user.id ? user.id : null,
      }).select("id, title, source, loan_id").single();
      if (error) throw error;
      return data as { id: string; title: string; source: string; loan_id: string | null };
    },
    onSuccess: (item) => {
      invalidateKeys.actionItems(queryClient);
      logCrud("create", "action_item", item.id, {
        title: item.title,
        source: item.source,
        loan_id: item.loan_id,
      });
      toast.success("Action item created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create action item");
    },
  });
}

export function useUpdateActionItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: ActionItemStatus }) => {
      const { error } = await supabase.from("action_items").update({ status }).eq("id", itemId);
      if (error) throw error;
      return { itemId, status };
    },
    onSuccess: ({ itemId, status }) => {
      invalidateKeys.actionItems(queryClient);
      logCrud("update", "action_item", itemId, { status });
      toast.success("Status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update status");
    },
  });
}

export function useUpdateActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      updates,
    }: {
      itemId: string;
      updates: Partial<ActionItem>;
    }) => {
      // Only allow editable fields to be sent to Supabase.
      const {
        id: _id,
        created_by_user_id: _createdBy,
        agent_id: _agentId,
        source: _source,
        created_at: _createdAt,
        updated_at: _updatedAt,
        metadata: _metadata,
        loan: _loan,
        assigned_to: _assignedToProfile,
        assigned_by: _assignedByProfile,
        ...safeUpdates
      } = updates as any;

      const { error } = await supabase
        .from("action_items")
        .update(safeUpdates)
        .eq("id", itemId);

      if (error) throw error;
      return { itemId };
    },
    onSuccess: ({ itemId }) => {
      invalidateKeys.actionItems(queryClient);
      logCrud("update", "action_item", itemId);
      toast.success("Action item updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update task");
    },
  });
}

export function useDeleteActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("action_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: (_data, itemId) => {
      // Optimistically remove the deleted task from any cached lists.
      queryClient.setQueriesData<ActionItem[] | undefined>(
        { queryKey: queryKeys.actionItems.all },
        (old) => (Array.isArray(old) ? old.filter((item) => item.id === itemId ? false : true) : old),
      );

      invalidateKeys.actionItems(queryClient);
      logCrud("delete", "action_item", itemId);
      toast.success("Task deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete task");
    },
  });
}

export interface TaskComment {
  comment_id: string;
  task_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  user?: { full_name: string | null; email: string | null } | null;
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.actionItems.all, "comments", taskId],
    queryFn: async (): Promise<TaskComment[]> => {
      if (!taskId) return [];

      const { data, error } = await supabase
        .from("task_comments")
        .select("comment_id, task_id, user_id, comment_text, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const comments = (data ?? []) as unknown as TaskComment[];
      const userIds = [...new Set(comments.map((c) => c.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        for (const c of comments) {
          (c as any).user = profileMap.get(c.user_id) ?? null;
        }
      }

      return comments;
    },
    enabled: !!taskId,
  });
}

export function useAddTaskComment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, text }: { taskId: string; text: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (!text.trim()) throw new Error("Comment cannot be empty");

      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        user_id: user.id,
        comment_text: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.actionItems.all, "comments", vars.taskId] });
      toast.success("Comment added");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add comment");
    },
  });
}

export function useAssignableUsers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.actionItems.all, "assignable-users", user?.id ?? "anon"],
    queryFn: async (): Promise<UserOption[]> => {
      if (!user) return [];

      const [{ data: myProfile }, { data: myRoleRow }] = await Promise.all([
        supabase.from("profiles").select("id, branch_id").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role, custom_role_id").eq("user_id", user.id).maybeSingle(),
      ]);

      let myCustomRoleSlug: string | null = null;
      if (myRoleRow?.custom_role_id) {
        const { data: role } = await supabase
          .from("roles")
          .select("slug")
          .eq("id", myRoleRow.custom_role_id)
          .maybeSingle();
        myCustomRoleSlug = (role as any)?.slug ?? null;
      }

      const appRole = (myRoleRow as any)?.role ?? null;
      const myBranchId = (myProfile as any)?.branch_id ?? null;

      // Hierarchy rules (pragmatic defaults):
      // - admin: can assign to anyone
      // - moderator: can assign within own branch
      // - branch_manager (custom role): within own branch
      // - loan_officer (default): self only
      if (appRole === "admin") {
        const { data } = await supabase.from("profiles").select("id, full_name, email, branch_id").order("full_name");
        return (data ?? []) as unknown as UserOption[];
      }

      if (myCustomRoleSlug === "branch_manager" || appRole === "moderator") {
        if (!myBranchId) {
          const { data } = await supabase.from("profiles").select("id, full_name, email, branch_id").eq("id", user.id);
          return (data ?? []) as unknown as UserOption[];
        }

        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email, branch_id")
          .eq("branch_id", myBranchId)
          .order("full_name");
        return (data ?? []) as unknown as UserOption[];
      }

      const { data } = await supabase.from("profiles").select("id, full_name, email, branch_id").eq("id", user.id);
      return (data ?? []) as unknown as UserOption[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
