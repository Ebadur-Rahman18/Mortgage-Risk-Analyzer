// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { integrationSettingsKeys } from '@/hooks/useIntegrationSettings';
import { queryKeys } from '@/lib/cache';

export function useLosSyncLendingPad() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('los-sync-lendingpad', {
        body: {},
      });
      if (error) throw error;
      return data as {
        success?: boolean;
        error?: string;
        loans_fetched?: number;
        loans_upserted?: number;
        detail?: string;
        errors?: string[];
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.byProvider('lendingpad') });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      const rowErrors = data?.errors?.length
        ? ` Some rows: ${data.errors.slice(0, 4).join('; ')}${data.errors.length > 4 ? '…' : ''}`
        : '';
      toast({
        title: 'LendingPad sync complete',
        description: `Fetched ${data?.loans_fetched ?? 0}, upserted ${data?.loans_upserted ?? 0} loan(s).${rowErrors}`,
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'LendingPad sync failed',
        description: e.message,
        variant: 'destructive',
      });
    },
  });
}
