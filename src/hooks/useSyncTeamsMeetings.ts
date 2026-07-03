/**
 * Hook for syncing Microsoft Teams meetings to the local database
 * 
 * NOTE: Requires meetings table to be created via database migration
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface SyncResult {
  synced: number;
  updated: number;
  errors: number;
  total: number;
  calendarAvailable?: boolean;
}

export interface SyncOptions {
  source?: 'local' | 'calendar' | 'both';
  daysAhead?: number;
  daysBehind?: number;
}

export function useSyncTeamsMeetings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (options: SyncOptions = { source: 'both' }): Promise<SyncResult> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Table not yet created - return empty result
      console.warn('[useSyncTeamsMeetings] meetings table not yet created');
      return {
        synced: 0,
        updated: 0,
        errors: 0,
        total: 0,
        calendarAvailable: false,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });

      toast({
        title: "Meetings Feature",
        description: "Meetings table requires database migration to enable sync.",
      });
    },
    onError: (error: Error) => {
      console.error('[SyncTeamsMeetings] Sync failed:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Teams meetings.",
        variant: "destructive",
      });
    },
  });
}
