import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useDocuSignEnabled() {
  return useQuery({
    queryKey: ["integration-settings", "docusign"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_settings")
        .select("is_active")
        .eq("provider_name", "docusign")
        .maybeSingle();
      return !!data?.is_active;
    },
    staleTime: 60_000,
  });
}
