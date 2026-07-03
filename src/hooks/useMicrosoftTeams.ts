/**
 * React hook for Microsoft Teams integration
 * Handles fetching and syncing user's joined Teams
 * 
 * NOTE: Requires user_microsoft_teams table to be created via migration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyJoinedTeams, MicrosoftTeam, ForbiddenError } from '@/lib/microsoftGraphClient';
import { useAuth } from '@/contexts/AuthContext';

export interface StoredTeam {
  id: string;
  user_id: string;
  team_id: string;
  display_name: string;
  description: string | null;
  visibility: string | null;
  web_url: string | null;
  is_archived: boolean;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export function useMicrosoftTeams() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch teams - stubbed until table is created
  const teamsQuery = useQuery({
    queryKey: ['microsoft-teams', user?.id],
    queryFn: async (): Promise<StoredTeam[]> => {
      console.log('[useMicrosoftTeams] Teams table not yet created, returning empty array');
      return [];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Sync teams from Microsoft Graph - stubbed
  const syncMutation = useMutation({
    mutationFn: async (): Promise<MicrosoftTeam[]> => {
      if (!user?.id) throw new Error('Not authenticated');
      console.warn('[useMicrosoftTeams] Sync requires user_microsoft_teams table migration');
      return [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoft-teams'] });
    },
  });

  return {
    teams: teamsQuery.data ?? [],
    isLoading: teamsQuery.isLoading,
    error: teamsQuery.error,
    syncTeams: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
    syncError: syncMutation.error,
    lastSynced: teamsQuery.data?.[0]?.synced_at,
  };
}
