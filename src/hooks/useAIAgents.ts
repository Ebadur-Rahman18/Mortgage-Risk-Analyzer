import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { logCrud } from "@/lib/activity-logger";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import { useHideDemoData } from "@/hooks/useHideDemoData";

export interface AIAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  system_prompt: string;
  data_sources: unknown;
  provider_config: unknown;
  required_role: string | null;
  is_enabled: boolean;
  memory_enabled: boolean;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  user_id: string;
  input: string | null;
  output: string | null;
  status: string | null;
  error_message: string | null;
  latency_ms: number | null;
  context: unknown;
  token_metrics: unknown;
  provider_used: string | null;
  model_used: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

export interface AgentProviderConfig {
  provider?: "lovable" | "openai" | "google" | "anthropic" | "perplexity";
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AgentMetadata {
  avatar?: string;
  is_public?: boolean;
  tools?: Record<string, boolean>;
  /** When Knowledge Base tool is on: limit search to these knowledge entry UUIDs (optional). */
  knowledge_entry_ids?: string[];
  /** When Knowledge Base tool is on: limit search to entries in these category UUIDs (optional). */
  knowledge_category_ids?: string[];
}

export interface AgentFormData {
  name: string;
  slug?: string;
  description?: string;
  category: string;
  system_prompt: string;
  is_enabled: boolean;
  memory_enabled: boolean;
  /** Required role(s) from DB for custom agents; comma-separated, e.g. "loan_officer, branch_manager". Empty = all authenticated users. */
  required_role?: string | null;
  provider_config?: AgentProviderConfig;
  metadata?: AgentMetadata;
}

function normalizeAgentSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAgentSlug(name: string, requestedSlug?: string): string {
  const normalizedRequested = normalizeAgentSlug(requestedSlug ?? "");
  if (normalizedRequested) return normalizedRequested;

  const normalizedName = normalizeAgentSlug(name);
  if (normalizedName) return normalizedName;

  return `agent-${crypto.randomUUID().slice(0, 8)}`;
}

export function useAIAgents() {
  return useQuery({
    queryKey: queryKeys.ai.agents,
    queryFn: async (): Promise<AIAgent[]> => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AIAgent[];
    },
  });
}

export function useAIAgent(id: string) {
  return useQuery({
    queryKey: queryKeys.ai.agent(id),
    queryFn: async (): Promise<AIAgent | null> => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as AIAgent | null;
    },
    enabled: !!id,
  });
}

export function useAIAgentBySlug(slug: string) {
  return useQuery({
    queryKey: [...queryKeys.ai.agents, "slug", slug],
    queryFn: async (): Promise<AIAgent | null> => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as AIAgent | null;
    },
    enabled: !!slug,
  });
}

export function useEnabledAgentBySlug(slug: string) {
  const { data: agents } = useAIAgents();
  return agents?.find((a) => a.slug === slug && a.is_enabled) ?? null;
}

/**
 * Returns only the agents that are both enabled AND allowed for the current
 * user's role, using AGENT_ALLOWED_ROLES_BY_SLUG from src/lib/agentRoles.ts.
 *
 * Used by AgentsBrowse so each role only sees their permitted agents.
 */
export function useRoleFilteredAgents() {
  const { profile } = useAuth();
  const query = useAIAgents();

  const data = useMemo(
    () =>
      (query.data ?? []).filter(
        (agent) => agent.is_enabled && isAgentAllowedForUser(agent.slug, profile, agent.required_role),
      ),
    [query.data, profile],
  );

  return { ...query, data };
}

export function useAgentRuns(agentId?: string) {
  const { user } = useAuth();
  const hideDemo = useHideDemoData();

  return useQuery({
    queryKey: agentId ? [...queryKeys.ai.runs(agentId), hideDemo] : ["ai", "runs", hideDemo],
    queryFn: async (): Promise<AgentRun[]> => {
      let query = supabase
        .from("ai_agent_runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (hideDemo) {
        query = query.eq("is_demo", false);
      }

      if (agentId) {
        query = query.eq("agent_id", agentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AgentRun[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AgentFormData): Promise<AIAgent> => {
      const slug = buildAgentSlug(data.name, data.slug);
      const payload: Record<string, unknown> = {
        name: data.name,
        slug,
        description: data.description ?? null,
        category: data.category,
        system_prompt: data.system_prompt,
        is_enabled: data.is_enabled,
        memory_enabled: data.memory_enabled,
        required_role: data.required_role?.trim() || null,
      };
      if (data.provider_config && Object.keys(data.provider_config).length > 0) {
        payload.provider_config = data.provider_config;
      }
      if (data.metadata && Object.keys(data.metadata).length > 0) {
        payload.metadata = data.metadata;
      }
      const { data: created, error } = await supabase.from("ai_agents").insert(payload).select().single();
      if (error) throw error;
      return created as AIAgent;
    },
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agents });
      logCrud("create", "agent", agent.id, { name: agent.name, slug: agent.slug });
      toast.success("Agent created successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to create agent:", error);
      toast.error(error.message || "Failed to create agent");
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AgentFormData> }): Promise<AIAgent> => {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.slug !== undefined || data.name !== undefined) {
        payload.slug = buildAgentSlug(data.name ?? "", data.slug);
      }
      if (data.description !== undefined) payload.description = data.description;
      if (data.category !== undefined) payload.category = data.category;
      if (data.system_prompt !== undefined) payload.system_prompt = data.system_prompt;
      if (data.is_enabled !== undefined) payload.is_enabled = data.is_enabled;
      if (data.memory_enabled !== undefined) payload.memory_enabled = data.memory_enabled;
      if (data.required_role !== undefined) payload.required_role = data.required_role?.trim() || null;
      if (data.provider_config !== undefined) payload.provider_config = data.provider_config;
      if (data.metadata !== undefined) payload.metadata = data.metadata;
      const { data: updated, error } = await supabase.from("ai_agents").update(payload).eq("id", id).select().single();
      if (error) throw error;
      return updated as AIAgent;
    },
    onSuccess: (agent, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agents });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agent(id) });
      logCrud("update", "agent", agent.id, { name: agent.name, slug: agent.slug });
      toast.success("Agent updated successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to update agent:", error);
      toast.error(error.message || "Failed to update agent");
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_agents").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agents });
      logCrud("delete", "agent", id);
      toast.success("Agent deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to delete agent:", error);
      toast.error("Failed to delete agent");
    },
  });
}

export function useToggleAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }): Promise<AIAgent> => {
      const { data, error } = await supabase.from("ai_agents").update({ is_enabled: enabled }).eq("id", id).select().single();
      if (error) throw error;
      return data as AIAgent;
    },
    onSuccess: (agent, { id, enabled }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agents });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agent(id) });
      logCrud("update", "agent", agent.id, { is_enabled: enabled });
      toast.success("Agent status updated");
    },
    onError: (error: Error) => {
      console.error("Failed to toggle agent:", error);
      toast.error("Failed to update agent status");
    },
  });
}

export function useRunAgent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ agentId, input }: { agentId: string; input: string }): Promise<AgentRun> => {
      if (!user?.id) {
        throw new Error("User must be signed in to run an agent");
      }

      // Resolve the agent slug for the server-side run-ai-agent function
      const { data: agent, error: agentError } = await supabase
        .from("ai_agents")
        .select("id, slug")
        .eq("id", agentId)
        .single();
      if (agentError || !agent) {
        throw new Error("Agent configuration not found");
      }

      // Delegate to run-ai-agent edge function which loads system prompt server-side
      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: { agent_slug: agent.slug, agent_id: agent.id, input },
      });

      if (error) {
        console.error("run-ai-agent error:", error);
        throw error;
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      // Fetch the most recent run row that was just logged by the edge function
      const { data: runRow, error: runErr } = await supabase
        .from("ai_agent_runs")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (runErr || !runRow) {
        // Return a synthetic run object so the UI can still show the response
        return {
          id: crypto.randomUUID(),
          agent_id: agentId,
          user_id: user.id,
          input,
          output: data?.output ?? "No response",
          status: "completed",
          error_message: null,
          latency_ms: data?.latency_ms ?? null,
          context: null,
          token_metrics: data?.usage ?? null,
          provider_used: "openai",
          model_used: data?.model_used ?? null,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as AgentRun;
      }

      return runRow as AgentRun;
    },
    onSuccess: (_, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.runs(agentId) });
      queryClient.invalidateQueries({ queryKey: ["ai-usage-analytics"] });
      toast.success("Agent run completed");
    },
    onError: (error: Error) => {
      console.error("Failed to run agent:", error);
      toast.error("Failed to run agent");
    },
  });
}

export function useUpdateRunStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      runId,
      status,
      output,
      error: errorMsg,
    }: {
      runId: string;
      status: string;
      output?: string;
      error?: string;
    }) => {
      const updates: Record<string, unknown> = { status };
      if (output) updates.output = output;
      if (errorMsg) updates.error_message = errorMsg;

      const { error } = await supabase
        .from("ai_agent_runs")
        .update(updates)
        .eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "runs"] });
    },
    onError: (error: Error) => {
      console.error("Failed to update run status:", error);
    },
  });
}
