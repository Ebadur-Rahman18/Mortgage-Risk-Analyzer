/**
 * Integration Hub Hooks
 * Note: Requires integration tables to be created in the database
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  IntegrationCategory,
  IntegrationProvider,
  IntegrationField,
  OrganizationIntegration,
  IntegrationService,
  IntegrationUsageLog,
} from '@/lib/integration-utils';

// ============================================
// QUERY KEYS
// ============================================
export const integrationKeys = {
  all: ['integrations'] as const,
  categories: () => [...integrationKeys.all, 'categories'] as const,
  providers: () => [...integrationKeys.all, 'providers'] as const,
  providersByCategory: (categoryId: string) =>
    [...integrationKeys.providers(), categoryId] as const,
  provider: (slug: string) => [...integrationKeys.providers(), slug] as const,
  fields: (providerId: string) => [...integrationKeys.all, 'fields', providerId] as const,
  orgIntegrations: () => [...integrationKeys.all, 'org-integrations'] as const,
  orgIntegration: (providerId: string) =>
    [...integrationKeys.orgIntegrations(), providerId] as const,
  services: (providerId: string) => [...integrationKeys.all, 'services', providerId] as const,
  usageLogs: (filters?: any) => [...integrationKeys.all, 'usage-logs', filters] as const,
};

// Note: All integration tables need to be created in the database
// These hooks return empty data until the tables are created

// ============================================
// CATEGORIES
// ============================================
export function useIntegrationCategories() {
  return useQuery({
    queryKey: integrationKeys.categories(),
    queryFn: async (): Promise<IntegrationCategory[]> => {
      // Table not yet created - return empty array
      return [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================
// PROVIDERS
// ============================================
export function useIntegrationProviders(categoryId?: string) {
  return useQuery({
    queryKey: categoryId
      ? integrationKeys.providersByCategory(categoryId)
      : integrationKeys.providers(),
    queryFn: async (): Promise<IntegrationProvider[]> => {
      // Table not yet created - return empty array
      return [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useIntegrationProvider(slug: string) {
  return useQuery({
    queryKey: integrationKeys.provider(slug),
    queryFn: async (): Promise<IntegrationProvider | null> => {
      // Table not yet created - return null
      return null;
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================
// FIELDS
// ============================================
export function useIntegrationFields(providerId: string) {
  return useQuery({
    queryKey: integrationKeys.fields(providerId),
    queryFn: async (): Promise<IntegrationField[]> => {
      // Table not yet created - return empty array
      return [];
    },
    enabled: !!providerId,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================
// ORGANIZATION INTEGRATIONS
// ============================================
export function useOrganizationIntegrations() {
  return useQuery({
    queryKey: integrationKeys.orgIntegrations(),
    queryFn: async (): Promise<(OrganizationIntegration & { provider: IntegrationProvider })[]> => {
      // Table not yet created - return empty array
      return [];
    },
  });
}

export function useOrganizationIntegration(providerId: string) {
  return useQuery({
    queryKey: integrationKeys.orgIntegration(providerId),
    queryFn: async (): Promise<OrganizationIntegration | null> => {
      // Table not yet created - return null
      return null;
    },
    enabled: !!providerId,
  });
}

export function useConnectIntegration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      providerId,
      config,
    }: {
      providerId: string;
      config: Record<string, any>;
    }): Promise<OrganizationIntegration> => {
      toast({
        title: "Error",
        description: "Integration feature requires database migration",
        variant: "destructive",
      });
      throw new Error("organization_integrations table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
      toast({
        title: "Success",
        description: "Integration connected successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to connect integration",
        variant: "destructive",
      });
    },
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (integrationId: string): Promise<void> => {
      toast({
        title: "Error",
        description: "Integration feature requires database migration",
        variant: "destructive",
      });
      throw new Error("organization_integrations table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
      toast({
        title: "Success",
        description: "Integration disconnected successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect integration",
        variant: "destructive",
      });
    },
  });
}

// ============================================
// SERVICES
// ============================================
export function useIntegrationServices(providerId: string) {
  return useQuery({
    queryKey: integrationKeys.services(providerId),
    queryFn: async (): Promise<IntegrationService[]> => {
      // Table not yet created - return empty array
      return [];
    },
    enabled: !!providerId,
  });
}

export function useToggleService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      serviceId,
      enabled,
    }: {
      serviceId: string;
      enabled: boolean;
    }): Promise<void> => {
      toast({
        title: "Error",
        description: "Integration services feature requires database migration",
        variant: "destructive",
      });
      throw new Error("integration_services table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle service",
        variant: "destructive",
      });
    },
  });
}

// ============================================
// USAGE LOGS
// ============================================
export function useIntegrationUsageLogs(filters?: {
  providerId?: string;
  serviceId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: integrationKeys.usageLogs(filters),
    queryFn: async (): Promise<IntegrationUsageLog[]> => {
      // Table not yet created - return empty array
      return [];
    },
  });
}
