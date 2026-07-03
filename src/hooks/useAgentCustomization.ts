import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface AgentCustomization {
  id: string;
  user_id: string;
  agent_id: string;
  system_prompt_override: string | null;
  knowledge_entry_ids: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const key = (agentId: string, userId: string | null) =>
  ["agent_customization", agentId, userId] as const;

export function useAgentCustomization(agentId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: key(agentId ?? "", userId ?? null),
    enabled: !!agentId && !!userId,
    queryFn: async (): Promise<AgentCustomization | null> => {
      const { data, error } = await supabase
        .from("user_agent_customizations")
        .select("*")
        .eq("agent_id", agentId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as AgentCustomization | null) ?? null;
    },
  });
}

export function useUpsertAgentCustomization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      agent_id: string;
      user_id: string;
      system_prompt_override: string | null;
      knowledge_entry_ids: string[];
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("user_agent_customizations")
        .upsert(
          {
            agent_id: input.agent_id,
            user_id: input.user_id,
            system_prompt_override: input.system_prompt_override?.trim() || null,
            knowledge_entry_ids: input.knowledge_entry_ids ?? [],
            notes: input.notes ?? null,
          },
          { onConflict: "user_id,agent_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as AgentCustomization;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: key(row.agent_id, row.user_id) });
      toast.success("Customization saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResetAgentCustomization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ agent_id, user_id }: { agent_id: string; user_id: string }) => {
      const { error } = await supabase
        .from("user_agent_customizations")
        .delete()
        .eq("agent_id", agent_id)
        .eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key(vars.agent_id, vars.user_id) });
      toast.success("Reset to default");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
