import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  created_at: string;
}

export interface RoleFormData {
  name: string;
  description?: string;
  permissions: string[];
}

// Fetch all roles
export function useRoles() {
  return useQuery({
    queryKey: queryKeys.admin.roles,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Role[];
    },
  });
}

// Fetch single role
export function useRole(id: string) {
  return useQuery({
    queryKey: ["roles", "detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Role;
    },
    enabled: !!id,
  });
}

// Create role mutation
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RoleFormData) => {
      const slug = data.name.toLowerCase().replace(/\s+/g, '-');
      const { data: role, error } = await supabase
        .from("roles")
        .insert({
          name: data.name,
          slug: slug,
          description: data.description || null,
          permissions: data.permissions,
        })
        .select()
        .single();

      if (error) throw error;
      return role;
    },
    onSuccess: () => {
      invalidateKeys.roles(queryClient);
      toast.success("Role created successfully");
    },
    onError: (error: any) => {
      console.error("Error creating role:", error);
      toast.error("Failed to create role");
    },
  });
}

// Update role mutation
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RoleFormData }) => {
      const { data: role, error } = await supabase
        .from("roles")
        .update({
          name: data.name,
          description: data.description || null,
          permissions: data.permissions,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return role;
    },
    onSuccess: () => {
      invalidateKeys.roles(queryClient);
      toast.success("Role updated successfully");
    },
    onError: (error: any) => {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    },
  });
}

// Delete role mutation
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.roles(queryClient);
      toast.success("Role deleted successfully");
    },
    onError: (error: any) => {
      console.error("Error deleting role:", error);
      toast.error("Failed to delete role");
    },
  });
}
