import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { ClientFormData } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  status: string | null;
  metadata: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useClients(filters?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.clients.list(filters),
    queryFn: async (): Promise<Client[]> => {
      let query = supabase.from("clients").select("*").order("created_at", { ascending: false });

      // Apply search filter if provided
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching clients:", error);
        throw error;
      }

      return data || [];
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: async (): Promise<Client | null> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching client:", error);
        throw error;
      }

      return data;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ClientFormData): Promise<Client> => {
      const { data: { user } } = await supabase.auth.getUser();

      const clientData = {
        name: data.name,
        email: data.email || null,
        company: data.company || null,
        phone: data.phone || null,
        status: "active",
        metadata: data.notes ? { notes: data.notes } : {},
        created_by: user?.id || null,
      };

      const { data: client, error } = await supabase
        .from("clients")
        .insert(clientData)
        .select()
        .single();

      if (error) {
        console.error("Error creating client:", error);
        throw error;
      }

      return client;
    },
    onSuccess: (client) => {
      invalidateKeys.clients(queryClient);
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormData> }): Promise<Client> => {
      const updateData: any = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.company !== undefined) updateData.company = data.company || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.notes !== undefined) {
        updateData.metadata = data.notes ? { notes: data.notes } : {};
      }

      const { data: client, error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating client:", error);
        throw error;
      }

      return client;
    },
    onSuccess: (client) => {
      invalidateKeys.clients(queryClient);
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting client:", error);
        throw error;
      }
    },
    onSuccess: () => {
      invalidateKeys.clients(queryClient);
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    },
  });
}

// Helper to extract notes from client metadata
export function getClientNotes(client: Client | null): string {
  if (!client) return "";
  if (typeof client.metadata?.notes === "string") {
    return client.metadata.notes;
  }
  return "";
}

