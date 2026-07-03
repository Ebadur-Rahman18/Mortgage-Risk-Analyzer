import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import { extractEdgeFunctionErrorMessage, isPersistedRowNewer } from "@/lib/edgeFunctionUtils";

export interface RecommendedAction {
  title: string;
  description: string;
  assigned_to_user_id: string;
  assigned_to_name: string;
  loan_id?: string;
  loan_number?: string;
  priority: string;
}

export interface BranchCoachingDigestRow {
  id: string;
  branch_id: string | null;
  generated_by: string | null;
  period_start: string;
  period_end: string;
  narrative: string;
  recommended_actions: RecommendedAction[];
  officer_metrics: Json;
  ai_model: string | null;
  latency_ms: number | null;
  metadata: Json;
  created_at: string;
}

const keys = {
  all: ["branch_coaching_digests"] as const,
  byBranch: (branchId: string | null) =>
    ["branch_coaching_digests", branchId ?? "org"] as const,
};

export function useLatestBranchDigest(branchId: string | null | undefined) {
  return useQuery({
    queryKey: keys.byBranch(branchId ?? null),
    queryFn: async (): Promise<BranchCoachingDigestRow | null> => {
      let query = supabase
        .from("branch_coaching_digests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (branchId) {
        query = query.eq("branch_id", branchId);
      } else {
        query = query.is("branch_id", null);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        recommended_actions: (data.recommended_actions ?? []) as unknown as RecommendedAction[],
      } as BranchCoachingDigestRow;
    },
  });
}

export function useBranchDigestHistory(branchId: string | null | undefined, limit = 5) {
  return useQuery({
    queryKey: [...keys.byBranch(branchId ?? null), "history"],
    queryFn: async (): Promise<BranchCoachingDigestRow[]> => {
      let query = supabase
        .from("branch_coaching_digests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (branchId) {
        query = query.eq("branch_id", branchId);
      } else {
        query = query.is("branch_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        recommended_actions: (row.recommended_actions ?? []) as unknown as RecommendedAction[],
      })) as BranchCoachingDigestRow[];
    },
  });
}

export function useGenerateBranchDigest() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (branchId: string | null) => {
      if (!isAgentAllowedForUser("branch-performance-coach-agent", profile)) {
        throw new Error("You don't have permission to generate a coaching digest.");
      }
      const invokeStartedAt = Date.now();
      const beforeLatest = queryClient.getQueryData(
        keys.byBranch(branchId),
      ) as BranchCoachingDigestRow | null | undefined;
      const beforeLatestId = beforeLatest?.id ?? null;
      const beforeLatestCreatedAt = beforeLatest?.created_at ?? null;

      const { data, error } = await supabase.functions.invoke(
        "branch-performance-coach-agent",
        { body: { branch_id: branchId }, timeout: 120_000 },
      );

      if (error) {
        const msg = await extractEdgeFunctionErrorMessage(
          error,
          "Coaching digest generation failed",
        );

        try {
          let query = supabase
            .from("branch_coaching_digests")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1);

          if (branchId) query = query.eq("branch_id", branchId);
          else query = query.is("branch_id", null);

          const { data: latestRow, error: latestErr } = await query.maybeSingle();
          if (!latestErr && latestRow) {
            const latestId = String((latestRow as any).id ?? "");
            const latestCreatedAt = (latestRow as any).created_at as string | undefined;
            if (
              isPersistedRowNewer({
                invokeStartedAt,
                beforeId: beforeLatestId,
                beforeCreatedAt: beforeLatestCreatedAt,
                latestId,
                latestCreatedAt: latestCreatedAt ?? null,
              })
            ) {
              return {
                ...(latestRow as any),
                recommended_actions:
                  ((latestRow as any).recommended_actions ?? []) as unknown as RecommendedAction[],
              } as BranchCoachingDigestRow;
            }
          }
        } catch {
          // best effort only
        }
        throw new Error(msg);
      }
      if (data?.error) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Coaching digest generation failed",
        );
      }
      return data as BranchCoachingDigestRow;
    },
    onSuccess: (data, branchId) => {
      // Keep UI in sync even if backend enforces a different scope branch_id.
      queryClient.setQueryData(keys.byBranch(branchId), data);
      if (data?.branch_id && data.branch_id !== branchId) {
        queryClient.setQueryData(keys.byBranch(data.branch_id), data);
      }
      queryClient.invalidateQueries({ queryKey: keys.byBranch(branchId) });
      if (data?.branch_id && data.branch_id !== branchId) {
        queryClient.invalidateQueries({ queryKey: keys.byBranch(data.branch_id) });
      }
      toast.success("Coaching digest generated");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to generate coaching digest");
    },
  });
}
