import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";

export interface UserPermissionSettings {
  user_id: string;
  permissions: string[];
  updated_at: string;
}

export function useUserPermissionSettings(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.userPermissionSettings(userId ?? ""),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_permission_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        const msg = error.message ?? "";
        const code = (error as { code?: string }).code ?? "";
        if (code === "PGRST116" || msg.includes("does not exist") || msg.includes("404") || (error as { status?: number }).status === 404) {
          return null;
        }
        throw error;
      }
      return data as UserPermissionSettings | null;
    },
    enabled: !!userId,
  });
}

export function useUpsertUserPermissionSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: string[];
    }) => {
      const { data, error } = await supabase
        .from("user_permission_settings")
        .upsert(
          { user_id: userId, permissions },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data as UserPermissionSettings;
    },
    onSuccess: (data) => {
      invalidateKeys.userPermissionSettings(queryClient, data.user_id);
      toast.success("User permissions saved");
    },
    onError: (error: unknown) => {
      console.error("Error saving user permissions:", error);
      toast.error("Failed to save user permissions");
    },
  });
}
