// @ts-nocheck — MCT Lite: legacy types misalignment, runtime works against Lite schema
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/integrations/supabase/types";
import { useHideDemoData } from "@/hooks/useHideDemoData";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  read_at: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function mapRow(row: NotificationRow): Notification {
  const t = row.type;
  const type: Notification["type"] =
    t === "success" || t === "warning" || t === "error" ? t : "info";
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    message: row.message,
    type,
    is_read: row.is_read,
    read_at: row.read_at,
    link: row.link,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: row.created_at,
  };
}

export function useNotifications(filter?: "all" | "unread") {
  const { user } = useAuth();
  const hideDemo = useHideDemoData();

  return useQuery({
    queryKey: [...queryKeys.notifications.all, filter, hideDemo],
    queryFn: async (): Promise<Notification[]> => {
      if (!user) return [];

      let q = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (hideDemo) {
        q = q.eq("is_demo", false);
      }

      if (filter === "unread") {
        q = q.eq("is_read", false);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row) => mapRow(row as NotificationRow));
    },
    enabled: !!user,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: async (): Promise<number> => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: now })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notifications(queryClient);
    },
    onError: (error: unknown) => {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to mark as read");
    },
  });
}

export function useMarkAllAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!user) return;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: now })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notifications(queryClient);
      toast.success("All notifications marked as read");
    },
    onError: (error: unknown) => {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notifications(queryClient);
      toast.success("Notification deleted");
    },
    onError: (error: unknown) => {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    },
  });
}

/** Creates an in-app notification via edge function (server inserts with service role). */
export async function createNotification(data: {
  user_id: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  link?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.functions.invoke("send-notification", {
    body: {
      user_id: data.user_id,
      title: data.title,
      message: data.message,
      type: data.type ?? "info",
      link: data.link,
      metadata: data.metadata ?? {},
      channels: ["in_app"],
    },
  });
  if (error) throw error;
}
