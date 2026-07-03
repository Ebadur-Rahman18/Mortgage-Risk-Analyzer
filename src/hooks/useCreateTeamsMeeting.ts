/**
 * Hook for creating Microsoft Teams meetings
 * Note: Requires meetings table to be created in the database
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CreateTeamsMeetingInput } from "@/lib/validation";
import { toast as sonnerToast } from "sonner";

export interface CreatedTeamsMeeting {
  id: string;
  teams_meeting_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  join_url: string;
  calendar_event_id?: string;
  calendar_synced: boolean;
}

export interface CreateTeamsMeetingResult {
  meeting: CreatedTeamsMeeting;
  dbMeetingId: string;
  joinUrl: string;
}

export function useCreateTeamsMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTeamsMeetingInput): Promise<CreateTeamsMeetingResult> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Table not yet created
      sonnerToast.error("Teams meetings feature requires database migration");
      throw new Error("meetings table not yet created");
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast({
        title: "Meeting Created",
        description: `Meeting scheduled successfully.`,
      });
    },
    onError: (error: any) => {
      console.error('[CreateTeamsMeeting] Error:', error);
      
      let message = 'Failed to create meeting.';
      if (error.message?.includes('consent')) {
        message = 'Microsoft calendar permissions required. Please re-authenticate.';
      } else if (error.message?.includes('forbidden')) {
        message = 'Insufficient permissions to create meetings.';
      } else if (error.message) {
        message = error.message;
      }

      toast({
        title: "Meeting Creation Failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}
