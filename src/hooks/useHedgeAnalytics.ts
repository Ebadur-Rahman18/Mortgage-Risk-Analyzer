import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";

export interface HedgeAssumptionRow {
  id: string;
  name: string;
  effective_date: string;
  assumptions: Record<string, unknown>;
  is_active: boolean;
}

export interface HedgeSnapshotRow {
  id: string;
  snapshot_date: string;
  locked_volume: number | null;
  active_lock_count: number | null;
  optional_symbol: string | null;
  totals: Record<string, unknown>;
  assumptions_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export function useHedgeAssumptions() {
  return useQuery({
    queryKey: queryKeys.hedge.assumptions,
    queryFn: async (): Promise<HedgeAssumptionRow[]> => {
      const { data, error } = await supabase
        .from("hedge_assumptions_versions")
        .select("*")
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HedgeAssumptionRow[];
    },
  });
}

export function useHedgeSnapshots() {
  return useQuery({
    queryKey: queryKeys.hedge.snapshots,
    queryFn: async (): Promise<HedgeSnapshotRow[]> => {
      const { data, error } = await supabase
        .from("hedge_pipeline_snapshots")
        .select(
          "id, snapshot_date, locked_volume, active_lock_count, optional_symbol, totals, assumptions_snapshot, created_at",
        )
        .order("snapshot_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as HedgeSnapshotRow[];
    },
  });
}

export function useComputeHedgeSnapshot() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars?: { optionalSymbol?: string | null }) => {
      const { data, error } = await supabase.functions.invoke("compute-hedge-snapshot", {
        body: vars?.optionalSymbol?.trim()
          ? { optional_symbol: vars.optionalSymbol.trim() }
          : {},
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data) {
        throw new Error(String((data as { error?: string }).error ?? "Compute failed"));
      }
      return data as { snapshot?: HedgeSnapshotRow };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.hedge.snapshots });
    },
  });
}
