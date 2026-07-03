import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface TimelineEvent {
  id: string;
  loan_id: string;
  event_type: string;
  event_source: string;
  title: string;
  description: string | null;
  occurred_at: string;
  metadata: unknown;
  created_by: string | null;
  created_at: string;
}

export interface TimelineEventInsert {
  loan_id: string;
  event_type: string;
  event_source?: string;
  title: string;
  description?: string | null;
  occurred_at?: string;
  metadata?: unknown;
}

const timelineKeys = {
  all: ["loan_timeline_events"] as const,
  byLoan: (loanId: string) => ["loan_timeline_events", loanId] as const,
};

export function useTimelineEvents(loanId: string | undefined) {
  return useQuery({
    queryKey: timelineKeys.byLoan(loanId ?? ""),
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_timeline_events")
        .select("*")
        .eq("loan_id", loanId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
    enabled: !!loanId,
  });
}

export type CreateTimelineEventInput = TimelineEventInsert & { silent?: boolean };

export function useCreateTimelineEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTimelineEventInput) => {
      const { silent: _silent, ...rest } = input;
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("loan_timeline_events")
        .insert({
          ...rest,
          event_source: rest.event_source ?? "manual",
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TimelineEvent;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: timelineKeys.byLoan(variables.loan_id) });
      if (!variables.silent) toast.success("Timeline event added");
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });
}
