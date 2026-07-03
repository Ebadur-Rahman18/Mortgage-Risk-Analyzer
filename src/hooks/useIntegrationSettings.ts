/**
 * Integration Settings Hook
 * Manages API keys and integration configurations.
 * Ported from the main Control Tower Mortgage App.
 */
// @ts-nocheck

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface IntegrationSetting {
  id: string;
  provider_name: string;
  display_name: string;
  api_key?: string;
  api_key_masked?: string;
  config?: Record<string, any>;
  is_active: boolean;
  last_validated_at?: string;
  validation_status?: 'valid' | 'invalid' | 'not_tested' | 'error';
  validation_error?: string;
  created_at: string;
  updated_at: string;
}

export interface SaveIntegrationSettingParams {
  provider_name: string;
  api_key: string;
  config?: Record<string, any>;
}

export const integrationSettingsKeys = {
  all: ['integration-settings'] as const,
  lists: () => ['integration-settings', 'list'] as const,
  detail: (id?: string) => ['integration-settings', 'detail', id ?? ''] as const,
  byProvider: (provider: string) => ['integration-settings', provider] as const,
};

const DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI',
  perplexity: 'Perplexity',
  encompass: 'Encompass',
  lendingpad: 'LendingPad',
  hubspot: 'HubSpot',
  zoom: 'Zoom',
  sendgrid: 'SendGrid',
  'freddie-mac': 'Freddie Mac',
  'fannie-mae': 'Fannie Mae',
  'credit-bureau': 'Credit Bureau',
};

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '';
  return `${key.substring(0, 3)}...${key.substring(key.length - 4)}`;
}

export function useIntegrationSettings() {
  return useQuery({
    queryKey: integrationSettingsKeys.all,
    queryFn: async (): Promise<IntegrationSetting[]> => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as IntegrationSetting[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useIntegrationSetting(provider: string) {
  return useQuery({
    queryKey: integrationSettingsKeys.byProvider(provider),
    queryFn: async (): Promise<IntegrationSetting | null> => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('provider_name', provider)
        .maybeSingle();
      if (error) throw error;
      return (data as IntegrationSetting) ?? null;
    },
    enabled: !!provider,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveIntegrationSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: SaveIntegrationSettingParams) => {
      const { provider_name, api_key, config } = params;
      const api_key_masked = maskApiKey(api_key);
      const display_name = DISPLAY_NAMES[provider_name] || provider_name;

      const { data: existing } = await supabase
        .from('integration_settings')
        .select('id')
        .eq('provider_name', provider_name)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('integration_settings')
          .update({
            api_key,
            api_key_masked,
            config: config || {},
            is_active: true,
            validation_status: 'not_tested',
            updated_at: new Date().toISOString(),
          })
          .eq('id', (existing as any).id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('integration_settings')
        .insert({
          provider_name,
          display_name,
          api_key,
          api_key_masked,
          config: config || {},
          is_active: true,
          validation_status: 'not_tested',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      queryClient.invalidateQueries({
        queryKey: integrationSettingsKeys.byProvider(data.provider_name),
      });
      toast({ title: 'Success', description: 'Integration settings saved.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save API key',
        variant: 'destructive',
      });
    },
  });
}

export function useValidateIntegrationKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      provider_name,
      api_key,
      zoom_client_id,
      zoom_account_id,
      lendingpad_client_id,
      lendingpad_authorize_url,
      lendingpad_token_url,
      data_feed_base_url,
      encompass_username,
      encompass_client_id,
      encompass_token_url,
    }: {
      provider_name: string;
      api_key: string;
      zoom_client_id?: string;
      zoom_account_id?: string;
      lendingpad_client_id?: string;
      lendingpad_authorize_url?: string;
      lendingpad_token_url?: string;
      data_feed_base_url?: string;
      encompass_username?: string;
      encompass_client_id?: string;
      encompass_token_url?: string;
    }) => {
      const body: Record<string, string> = { provider: provider_name, apiKey: api_key };
      if (provider_name === 'zoom') {
        if (zoom_client_id) body.zoomClientId = zoom_client_id;
        if (zoom_account_id) body.zoomAccountId = zoom_account_id;
      }
      if (provider_name === 'lendingpad') {
        if (lendingpad_client_id) body.lendingpadClientId = lendingpad_client_id;
        if (lendingpad_authorize_url) body.lendingpadAuthorizeUrl = lendingpad_authorize_url;
        if (lendingpad_token_url) body.lendingpadTokenUrl = lendingpad_token_url;
      }
      if (provider_name === 'encompass') {
        if (encompass_username) body.encompassUsername = encompass_username;
        if (encompass_client_id) body.encompassClientId = encompass_client_id;
        if (encompass_token_url) body.encompassTokenUrl = encompass_token_url;
      }
      if (
        ['hubspot','encompass','freddie-mac','fannie-mae','credit-bureau'].includes(provider_name)
      ) {
        if (data_feed_base_url) body.dataFeedBaseUrl = data_feed_base_url;
      }

      const { data, error } = await supabase.functions.invoke('validate-api-key', { body });
      if (error) {
        if (
          error.message?.includes('FunctionsRelayError') ||
          error.message?.includes('not found') ||
          error.message?.includes('404')
        ) {
          throw new Error(
            'Validation function not deployed. You can still save the key — it will be tested when used.',
          );
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data: any, variables) => {
      const valid = !!data?.valid;
      supabase
        .from('integration_settings')
        .update({
          validation_status: valid ? 'valid' : 'invalid',
          validation_error: data?.error || null,
          last_validated_at: new Date().toISOString(),
        })
        .eq('provider_name', variables.provider_name)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
        });

      toast({
        title: valid ? 'Success' : 'Validation Failed',
        description: valid
          ? (data?.details?.message ?? 'Validated successfully.')
          : (data?.error || 'Validation failed'),
        variant: valid ? 'default' : 'destructive',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Validation Error',
        description: error.message || 'Failed to validate API key',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteIntegrationSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (provider_name: string) => {
      const { error } = await supabase
        .from('integration_settings')
        .delete()
        .eq('provider_name', provider_name);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      toast({ title: 'Success', description: 'Integration removed successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove integration',
        variant: 'destructive',
      });
    },
  });
}

export function useToggleIntegrationStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      provider_name,
      is_active,
    }: {
      provider_name: string;
      is_active: boolean;
    }) => {
      const { data, error } = await supabase
        .from('integration_settings')
        .update({ is_active })
        .eq('provider_name', provider_name)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      toast({
        title: 'Success',
        description: `Integration ${data.is_active ? 'enabled' : 'disabled'}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle integration',
        variant: 'destructive',
      });
    },
  });
}

// Aliases kept for back-compat with existing imports
export const useToggleIntegrationActive = useToggleIntegrationStatus;
export const useCreateIntegrationSetting = useSaveIntegrationSetting;
export const useTestIntegrationConnection = useValidateIntegrationKey;

export default useIntegrationSettings;
