import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * Triggers the sync-data-feed edge function for the given provider.
 * Provider is bound at hook-call time (matches call sites in integration cards).
 *
 * Usage:
 *   const { mutate: sync, isPending } = useSyncDataFeed("hubspot");
 *   <Button onClick={() => sync()} disabled={isPending}>Sync</Button>
 */
export function useSyncDataFeed(provider?: string) {
  return useMutation({
    mutationFn: async () => {
      if (!provider) throw new Error("No provider specified for data feed sync");
      const { data, error } = await supabase.functions.invoke("sync-data-feed", {
        body: { provider },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      return data as Record<string, unknown>;
    },
    onSuccess: () => {
      const label = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Data feed";
      toast.success(`${label} sync complete`);
    },
    onError: (error: Error) => {
      console.error(`[useSyncDataFeed] ${provider} sync failed:`, error);
      toast.error(error.message || "Sync failed. Check integration settings.");
    },
  });
}
