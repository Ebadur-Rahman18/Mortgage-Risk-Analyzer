import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import { useHideDemoData } from "@/hooks/useHideDemoData";

export interface AgentConversation {
  id: string;
  agent_id: string;
  user_id: string;
  title: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model_used: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface AgentMemoryRow {
  id: string;
  agent_id: string;
  user_id: string;
  memory_type: string;
  memory_category: string | null;
  content: string;
  importance_score: number;
  access_count: number;
  last_accessed_at: string | null;
  is_active: boolean;
  created_at: string;
  owner_label?: string | null;
}

export type AgentMemoryScope = "own" | "all";

function memoryScopeKey(userId: string, scope: AgentMemoryScope): string {
  return scope === "all" ? "all" : `own:${userId}`;
}

export function useAgentConversations(agentId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ai.conversations(agentId ?? "", userId ?? ""),
    queryFn: async (): Promise<AgentConversation[]> => {
      const { data, error } = await supabase
        .from("agent_conversations")
        .select("id, agent_id, user_id, title, message_count, last_message_at, created_at, updated_at")
        .eq("agent_id", agentId!)
        .eq("user_id", userId!)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as AgentConversation[];
    },
    enabled: !!agentId && !!userId,
    staleTime: 30_000,
  });
}

export function useAgentMessages(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.ai.messages(conversationId ?? ""),
    queryFn: async (): Promise<AgentMessage[]> => {
      const { data, error } = await supabase
        .from("agent_messages")
        .select("id, conversation_id, role, content, model_used, latency_ms, created_at")
        .eq("conversation_id", conversationId!)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgentMessage[];
    },
    enabled: !!conversationId,
    staleTime: 10_000,
  });
}

export function useAgentMemories(
  agentId: string | undefined,
  userId: string | undefined,
  options?: { enabled?: boolean; scope?: AgentMemoryScope }
) {
  const scope = options?.scope ?? "own";
  const enabled = options?.enabled ?? true;
  const hideDemo = useHideDemoData();

  return useQuery({
    queryKey: queryKeys.ai.memories(agentId ?? "", `${memoryScopeKey(userId ?? "", scope)}:${hideDemo}`),
    queryFn: async (): Promise<AgentMemoryRow[]> => {
      let query = supabase
        .from("agent_memories")
        .select(
          "id, agent_id, user_id, memory_type, memory_category, content, importance_score, access_count, last_accessed_at, is_active, created_at"
        )
        .eq("agent_id", agentId!)
        .eq("is_active", true);

      if (hideDemo) {
        query = query.eq("is_demo", false);
      }

      if (scope === "own") {
        query = query.eq("user_id", userId!);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(scope === "all" ? 200 : 100);
      if (error) throw error;

      const rows = (data ?? []) as AgentMemoryRow[];
      if (scope !== "all" || rows.length === 0) return rows;

      const ownerIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ownerIds);

      const labelByUserId = new Map(
        (profiles ?? []).map((p) => {
          const name =
            typeof p.full_name === "string" && p.full_name.trim()
              ? p.full_name.trim()
              : typeof p.email === "string"
                ? p.email
                : p.id;
          return [p.id, name] as const;
        })
      );

      return rows.map((r) => ({
        ...r,
        owner_label: (labelByUserId.get(r.user_id) ?? r.user_id.slice(0, 8)) as string,
      }));
    },
    enabled: !!agentId && !!userId && enabled,
    staleTime: 30_000,
  });
}

export function useUpdateConversationTitle(agentId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, title }: { conversationId: string; title: string }) => {
      const { error } = await supabase
        .from("agent_conversations")
        .update({ title: title.trim() })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ai.conversations(agentId, userId),
      });
      toast.success("Conversation renamed");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to rename");
    },
  });
}

export function useDeleteAgentConversation(agentId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("agent_conversations")
        .delete()
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ai.conversations(agentId, userId),
      });
      toast.success("Conversation deleted");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to delete");
    },
  });
}

export function useForgetAgentMemory(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memoryId: string) => {
      const { error } = await supabase
        .from("agent_memories")
        .update({ is_active: false })
        .eq("id", memoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ai", "memories", agentId],
      });
      toast.success("Memory removed");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to remove memory");
    },
  });
}
