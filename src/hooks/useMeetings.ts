import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { MeetingFormData, MeetingStatus } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logMeetingAction } from "@/lib/activity-logger";

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  zoom_meeting_id: string | null;
  zoom_join_url: string | null;
  zoom_start_url: string | null;
  zoom_uuid: string | null;
  zoom_id: string | null;
  status: MeetingStatus | null;
  client_id: string | null;
  loan_id: string | null;
  organizer_id: string;
  location: string | null;
  meeting_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// The meetings table is queried via the typed client. Because the auto-generated
// Database type does not yet list `meetings`, we use `as any` on the `.from()` call
// so the rest of the query chain stays readable while TypeScript accepts it.
// Once `supabase gen types typescript` is re-run after the migration, these casts
// can be removed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meetingsTable = () => (supabase as any).from("meetings");

export function useMeetings(filters?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.meetings.list(filters),
    queryFn: async (): Promise<(Meeting & { clients?: { name: string } | null })[]> => {
      let query = meetingsTable()
        .select("*, clients(name), loans(loan_number)")
        .order("scheduled_at", { ascending: true });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as (Meeting & { clients?: { name: string } | null })[]) ?? [];
    },
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: queryKeys.meetings.detail(id),
    queryFn: async (): Promise<
      (Meeting & {
        clients?: { name: string; email: string } | null;
        loans?: { loan_number: string } | null;
      }) | null
    > => {
      const { data, error } = await meetingsTable()
        .select("*, clients(name, email), loans(loan_number)")
        .eq("id", id)
        .single();

      if (error) {
        // PGRST116 = row not found
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data as Meeting & {
        clients?: { name: string; email: string } | null;
        loans?: { loan_number: string } | null;
      };
    },
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: MeetingFormData): Promise<Meeting> => {
      if (!user) throw new Error("User not authenticated");

      const { data: meeting, error } = await meetingsTable()
        .insert({
          title: data.title,
          description: data.description || null,
          scheduled_at: data.meeting_date || null,
          duration_minutes: data.duration_minutes ?? null,
          location: data.location || null,
          client_id: data.client_id || null,
          loan_id: data.loan_id || null,
          zoom_meeting_id: data.zoom_meeting_id || null,
          zoom_join_url: data.zoom_join_url || null,
          organizer_id: user.id,
          meeting_type: data.meeting_type ?? "manual",
          status: "scheduled",
        })
        .select()
        .single();

      if (error) throw error;
      logMeetingAction("create", meeting.id, meeting.title);
      return meeting as Meeting;
    },
    onSuccess: () => {
      invalidateKeys.meetings(queryClient);
      toast({
        title: "Success",
        description: "Meeting created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MeetingFormData> & { status?: MeetingStatus } }): Promise<Meeting> => {
      const updateData: Record<string, unknown> = {};

      if (data.title !== undefined)            updateData.title            = data.title;
      if (data.description !== undefined)      updateData.description      = data.description || null;
      if (data.meeting_date !== undefined)     updateData.scheduled_at     = data.meeting_date || null;
      if (data.duration_minutes !== undefined) updateData.duration_minutes = data.duration_minutes ?? null;
      if (data.location !== undefined)         updateData.location         = data.location || null;
      if (data.client_id !== undefined)        updateData.client_id        = data.client_id || null;
      if (data.loan_id !== undefined)           updateData.loan_id           = data.loan_id || null;
      if (data.meeting_type !== undefined)     updateData.meeting_type      = data.meeting_type ?? "manual";
      if (data.zoom_meeting_id !== undefined)  updateData.zoom_meeting_id  = data.zoom_meeting_id || null;
      if (data.zoom_join_url !== undefined)    updateData.zoom_join_url    = data.zoom_join_url || null;
      if (data.status !== undefined)           updateData.status           = data.status;

      const { data: meeting, error } = await meetingsTable()
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      logMeetingAction("update", meeting.id, meeting.title);
      return meeting as Meeting;
    },
    onSuccess: (meeting) => {
      invalidateKeys.meetings(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.detail(meeting.id) });
      toast({
        title: "Success",
        description: "Meeting updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update meeting",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Fetch title before deletion for the activity log
      const { data: meeting } = await meetingsTable()
        .select("title")
        .eq("id", id)
        .single();

      const { error } = await meetingsTable()
        .delete()
        .eq("id", id);

      if (error) throw error;

      logMeetingAction("delete", id, meeting?.title);
    },
    onSuccess: () => {
      invalidateKeys.meetings(queryClient);
      toast({
        title: "Success",
        description: "Meeting deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete meeting",
        variant: "destructive",
      });
    },
  });
}
