import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";

export interface SLAConfiguration {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  from_status: string | null;
  to_status: string | null;
  target_hours: number;
  warning_hours: number | null;
  severity: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useSLAConfigurations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.slaConfigurations.all,
    queryFn: async (): Promise<SLAConfiguration[]> => {
      const { data, error } = await supabase
        .from("sla_configurations")
        .select("*")
        .order("scope")
        .order("name");

      if (error) throw error;
      return (data ?? []) as SLAConfiguration[];
    },
    enabled: !!user,
  });
}

export function useUpdateSLAConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      target_hours?: number;
      warning_hours?: number | null;
      severity?: string;
      is_active?: boolean;
    }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from("sla_configurations")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slaConfigurations.all });
      toast.success("SLA configuration updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update SLA configuration");
    },
  });
}

/**
 * For a given loan status, find which SLA rules apply (stage_transition where from_status matches).
 */
export function useSLAForLoanStatus(loanStatus: string | undefined) {
  const { data: configs } = useSLAConfigurations();

  if (!loanStatus || !configs) return [];

  return configs.filter(
    (c) => c.is_active && c.scope === "stage_transition" && c.from_status === loanStatus,
  );
}
