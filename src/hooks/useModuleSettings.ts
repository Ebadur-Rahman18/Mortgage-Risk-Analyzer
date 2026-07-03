import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";

export interface ModuleSetting {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  enabled: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useModuleSettings() {
  return useQuery({
    queryKey: queryKeys.admin.moduleSettings,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_settings")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ModuleSetting[];
    },
  });
}

export function useModuleEnabled(slug: string) {
  const { data: modules = [], isLoading } = useModuleSettings();
  const module = modules.find((m) => m.slug === slug);
  return { enabled: module?.enabled ?? false, isLoading };
}

export function isModuleEnabled(modules: ModuleSetting[] | undefined, slug: string): boolean {
  if (!modules) return false;
  return modules.find((m) => m.slug === slug)?.enabled ?? false;
}

export function useUpdateModuleSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from("module_settings")
        .update({ enabled })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ModuleSetting;
    },
    onSuccess: () => {
      invalidateKeys.moduleSettings(queryClient);
      toast.success("Module setting updated");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update module");
    },
  });
}
