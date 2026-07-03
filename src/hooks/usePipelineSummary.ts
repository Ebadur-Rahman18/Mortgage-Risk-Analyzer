// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ManagerDashboardData } from "@/hooks/useManagerDashboard";

export function useGeneratePipelineSummary() {
  return useMutation({
    mutationFn: async (data: ManagerDashboardData) => {
      const { data: res, error } = await supabase.functions.invoke("generate-pipeline-summary", {
        body: {
          snapshot: {
            metrics: data.metrics,
            pipeline: data.pipeline,
            bottlenecks: data.bottlenecks,
          },
        },
      });
      if (error) throw error;
      const body = res as { error?: string; summary?: string };
      if (body?.error) throw new Error(body.error);
      if (!body?.summary) throw new Error("No summary returned");
      return body.summary;
    },
  });
}
