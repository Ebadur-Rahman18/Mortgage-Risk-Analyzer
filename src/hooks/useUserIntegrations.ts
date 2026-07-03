/**
 * User Integration Hooks
 * Sprint 10: User Integration Connections
 * Handles individual user OAuth connections to external services
 * 
 * NOTE: Requires user_oauth_tokens and organization_integrations tables
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserOAuthToken {
  id: string;
  user_id: string;
  provider_slug: string;
  token_type: string;
  expires_at: string | null;
  scopes: string[];
  account_email: string | null;
  account_name: string | null;
  account_id: string | null;
  account_avatar_url: string | null;
  is_active: boolean;
  last_used_at: string | null;
  last_refreshed_at: string | null;
  error_message: string | null;
  error_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AvailableProvider {
  provider_slug: string;
  provider_name: string;
  description: string;
  icon: string;
  scopes: string[];
  oauth_enabled: boolean;
}

// Fetch user's connected services - stubbed until tables created
export function useUserOAuthTokens() {
  const { user } = useAuth();

  return useQuery<UserOAuthToken[]>({
    queryKey: ['user-oauth-tokens', user?.id],
    queryFn: async (): Promise<UserOAuthToken[]> => {
      // Tables not yet created
      return [];
    },
    enabled: !!user,
  });
}

// Fetch a specific provider connection - stubbed
export function useUserOAuthToken(providerSlug: string) {
  const { user } = useAuth();

  return useQuery<UserOAuthToken | null>({
    queryKey: ['user-oauth-token', user?.id, providerSlug],
    queryFn: async (): Promise<UserOAuthToken | null> => {
      // Tables not yet created
      return null;
    },
    enabled: !!user && !!providerSlug,
  });
}

// Check if a provider is available for user connection - stubbed
export function useAvailableUserProviders() {
  return useQuery<AvailableProvider[]>({
    queryKey: ['available-user-providers'],
    queryFn: async (): Promise<AvailableProvider[]> => {
      // Tables not yet created
      return [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Initiate OAuth connection for a provider
export function useConnectOAuth() {
  return useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      const { data, error } = await supabase.functions.invoke('user-oauth-connect', {
        body: { provider },
      });

      if (error) throw error;

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }

      return data;
    },
    onError: (error: Error) => {
      toast.error(`Failed to connect: ${error.message}`);
    },
  });
}

// Disconnect a provider
export function useDisconnectOAuth() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('user-oauth-disconnect', {
        body: { provider },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-oauth-token', user?.id, variables.provider] });
      queryClient.invalidateQueries({ queryKey: ['available-user-providers'] });
      toast.success('Service disconnected successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });
}

// Refresh an OAuth token
export function useRefreshOAuthToken() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      const { data, error } = await supabase.functions.invoke('user-oauth-refresh', {
        body: { provider },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-oauth-token', user?.id, variables.provider] });
      queryClient.invalidateQueries({ queryKey: ['available-user-providers'] });
      toast.success('Token refreshed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to refresh token: ${error.message}`);
    },
  });
}

// Check if user has a valid token for a provider
export function useHasValidToken(providerSlug: string) {
  const { data: token, isLoading } = useUserOAuthToken(providerSlug);

  const isValid =
    token?.is_active &&
    (!token.expires_at || new Date(token.expires_at) > new Date()) &&
    !token.error_message;

  return {
    hasValidToken: isValid,
    token,
    isLoading,
    isExpired: token?.expires_at && new Date(token.expires_at) <= new Date(),
    hasError: !!token?.error_message,
    errorMessage: token?.error_message,
  };
}
