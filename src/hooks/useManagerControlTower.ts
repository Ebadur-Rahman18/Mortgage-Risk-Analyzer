// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { invalidateKeys } from "@/lib/cache";

export function useRunInactivityReminders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manager-inactivity-reminders", {
        body: {},
      });
      if (error) throw error;
      const body = data as { error?: string; summary?: Record<string, number> };
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: () => {
      invalidateKeys.managerDashboard(queryClient);
      invalidateKeys.actionItems(queryClient);
      invalidateKeys.notifications(queryClient);
    },
  });
}

export function useAskManagerInsight() {
  return useMutation({
    mutationFn: async (params: { question: string; snapshot: ManagerDashboardData }) => {
      const { data, error } = await supabase.functions.invoke("manager-insight-agent", {
        body: {
          question: params.question,
          snapshot: {
            metrics: params.snapshot.metrics,
            pipeline: params.snapshot.pipeline,
            bottlenecks: params.snapshot.bottlenecks,
            untouchedSummary: params.snapshot.untouchedSummary,
            teamActivity: params.snapshot.teamActivity.slice(0, 15),
            untouchedLoans: params.snapshot.untouchedLoans.slice(0, 30),
          },
        },
      });
      if (error) throw error;
      const body = data as { error?: string; answer?: string };
      if (body?.error) throw new Error(body.error);
      if (!body?.answer) throw new Error("No answer returned");
      return body.answer;
    },
  });
}
