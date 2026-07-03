/**
 * Auth Configuration Hook
 * Fetches dynamic authentication settings for login page
 * Note: Requires app_config and sso_configurations tables to be created
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface SSOProvider {
  id: string;
  provider_type: 'google_workspace' | 'azure_ad' | 'saml' | 'oidc';
  display_name: string;
  is_primary: boolean;
  is_enabled: boolean;
  client_id?: string;
  tenant_id?: string;
  domain_restrictions?: string[];
  auto_provision_role?: string;
  auto_create_users?: boolean;
  metadata?: Record<string, any>;
}

export interface AuthConfig {
  allowEmailPassword: boolean;
  allowPublicSignup: boolean;
  requireSSO: boolean;
  defaultSSOProvider: string | null;
  sessionTimeoutHours: number;
  ssoProviders: SSOProvider[];
}

export interface SSODomain {
  id: string;
  domain: string;
  sso_config_id: string;
  is_active: boolean;
}

// Default auth config until tables are created
const DEFAULT_AUTH_CONFIG: AuthConfig = {
  allowEmailPassword: true,
  allowPublicSignup: true,
  requireSSO: false,
  defaultSSOProvider: null,
  sessionTimeoutHours: 24,
  ssoProviders: [],
};

// Fetch auth configuration for login page - returns defaults until table exists
export function useAuthConfig() {
  return useQuery<AuthConfig>({
    queryKey: ['auth-config'],
    queryFn: async (): Promise<AuthConfig> => {
      // Tables not yet created - return default config
      return DEFAULT_AUTH_CONFIG;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch all SSO configurations (admin only) - returns empty until table exists
export function useSSOConfigurations() {
  return useQuery<SSOProvider[]>({
    queryKey: ['sso-configurations'],
    queryFn: async (): Promise<SSOProvider[]> => {
      // Table not yet created - return empty array
      return [];
    },
  });
}

// Create SSO configuration - disabled until table exists
export function useCreateSSOConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<SSOProvider>) => {
      toast.error("SSO configuration requires database migration");
      throw new Error("sso_configurations table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['auth-config'] });
      toast.success("SSO configuration created");
    },
    onError: (error: Error) => {
      console.error("Failed to create SSO config:", error);
    },
  });
}

// Update SSO configuration - disabled until table exists
export function useUpdateSSOConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SSOProvider> }) => {
      toast.error("SSO configuration requires database migration");
      throw new Error("sso_configurations table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['auth-config'] });
      toast.success("SSO configuration updated");
    },
    onError: (error: Error) => {
      console.error("Failed to update SSO config:", error);
    },
  });
}

// Delete SSO configuration - disabled until table exists
export function useDeleteSSOConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      toast.error("SSO configuration requires database migration");
      throw new Error("sso_configurations table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['auth-config'] });
      toast.success("SSO configuration deleted");
    },
    onError: (error: Error) => {
      console.error("Failed to delete SSO config:", error);
      toast.error("Failed to delete SSO configuration");
    },
  });
}

// Update auth configuration value - disabled until table exists
export function useUpdateAuthConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      console.warn("Auth config update skipped - app_config table not yet created");
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-config'] });
    },
    onError: (error: Error) => {
      console.error("Failed to update auth config:", error);
    },
  });
}

// Fetch SSO domains - returns empty until table exists
export function useSSODomains(configId?: string) {
  return useQuery<SSODomain[]>({
    queryKey: ['sso-domains', configId],
    queryFn: async (): Promise<SSODomain[]> => {
      // Table not yet created - return empty array
      return [];
    },
    enabled: !!configId,
  });
}

// Add SSO domain - disabled until table exists
export function useAddSSODomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configId, domain }: { configId: string; domain: string }) => {
      toast.error("SSO domains require database migration");
      throw new Error("sso_domains table not yet created");
    },
    onSuccess: (_, { configId }) => {
      queryClient.invalidateQueries({ queryKey: ['sso-domains', configId] });
      toast.success("Domain added");
    },
    onError: (error: Error) => {
      console.error("Failed to add domain:", error);
    },
  });
}

// Remove SSO domain - disabled until table exists
export function useRemoveSSODomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, configId }: { id: string; configId: string }) => {
      toast.error("SSO domains require database migration");
      throw new Error("sso_domains table not yet created");
    },
    onSuccess: (_, { configId }) => {
      queryClient.invalidateQueries({ queryKey: ['sso-domains', configId] });
      toast.success("Domain removed");
    },
    onError: (error: Error) => {
      console.error("Failed to remove domain:", error);
    },
  });
}
