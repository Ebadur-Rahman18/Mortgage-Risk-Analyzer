/**
 * React hook for Microsoft Teams Channels
 * Handles fetching and syncing channels for teams
 * 
 * NOTE: Requires user_microsoft_teams_channels table to be created via migration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export interface StoredChannel {
  id: string;
  user_id: string;
  team_id: string;
  channel_id: string;
  display_name: string;
  description: string | null;
  membership_type: string | null;
  web_url: string | null;
  email: string | null;
  is_favorite: boolean;
  created_date_time: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

interface UseChannelsOptions {
  teamId?: string;
  autoRefresh?: boolean;
}

export function useMicrosoftTeamsChannels(options: UseChannelsOptions = {}) {
  const { teamId, autoRefresh = true } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch channels - stubbed until table is created
  const channelsQuery = useQuery({
    queryKey: ['microsoft-teams-channels', user?.id, teamId],
    queryFn: async (): Promise<StoredChannel[]> => {
      console.log('[useMicrosoftTeamsChannels] Channels table not yet created, returning empty array');
      return [];
    },
    enabled: !!user?.id && autoRefresh,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Sync channels for a single team - stubbed
  const syncTeamChannelsMutation = useMutation({
    mutationFn: async (targetTeamId: string): Promise<any[]> => {
      console.warn('[useMicrosoftTeamsChannels] Sync requires user_microsoft_teams_channels table migration');
      return [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoft-teams-channels'] });
    },
  });

  // Sync channels for all teams - stubbed
  const syncAllChannelsMutation = useMutation({
    mutationFn: async (teamIds: string[]): Promise<number> => {
      console.warn('[useMicrosoftTeamsChannels] Sync requires user_microsoft_teams_channels table migration');
      return 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoft-teams-channels'] });
    },
  });

  return {
    channels: channelsQuery.data ?? [],
    isLoading: channelsQuery.isLoading,
    error: channelsQuery.error,
    
    syncTeamChannels: syncTeamChannelsMutation.mutateAsync,
    isSyncingTeam: syncTeamChannelsMutation.isPending,
    syncTeamError: syncTeamChannelsMutation.error,
    
    syncAllChannels: syncAllChannelsMutation.mutateAsync,
    isSyncingAll: syncAllChannelsMutation.isPending,
    syncAllError: syncAllChannelsMutation.error,
    
    getChannelsForTeam: (tId: string) => 
      (channelsQuery.data ?? []).filter(c => c.team_id === tId),
  };
}
