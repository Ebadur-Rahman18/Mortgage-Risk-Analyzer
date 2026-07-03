import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useHideDemoData } from "@/hooks/useHideDemoData";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  client_id: string | null;
  meeting_id: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  // Joined data
  clients?: { name: string } | null;
  meetings?: { title: string } | null;
  assigned_user?: { full_name: string; email: string; raw_user_meta_data?: any } | null;
}

export interface TaskFormData {
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assigned_to?: string;
  client_id?: string;
  meeting_id?: string;
}

export function useTasks(filters?: Record<string, any>) {
  const hideDemo = useHideDemoData();
  return useQuery({
    queryKey: ["tasks", "list", filters, hideDemo],
    queryFn: async (): Promise<Task[]> => {
      console.log("🔍 Fetching tasks with filters:", filters);
      
      let query = supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (hideDemo) {
        query = query.eq("is_demo", false);
      }

      // Apply filters
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.priority) {
        query = query.eq("priority", filters.priority);
      }
      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters?.client_id) {
        query = query.eq("client_id", filters.client_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Error fetching tasks:", error);
        throw error;
      }

      console.log("✅ Fetched tasks:", data?.length || 0, "tasks");
      console.log("📋 Task data:", data);

      // Fetch related data separately to avoid join issues
      if (data && data.length > 0) {
        // Fetch client names
        const clientIds = data
          .map(task => task.client_id)
          .filter(id => id !== null);
        
        let clientsMap: Record<string, any> = {};
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name")
            .in("id", clientIds);
          
          if (clients) {
            clientsMap = clients.reduce((acc, client) => {
              acc[client.id] = client;
              return acc;
            }, {} as Record<string, any>);
          }
        }

        // Fetch assigned user data
        const assignedUserIds = data
          .map(task => task.assigned_to)
          .filter(id => id !== null);
        
        let usersMap: Record<string, any> = {};
        if (assignedUserIds.length > 0) {
          const { data: users } = await supabase
            .from("profiles")
            .select("id, email, full_name")
            .in("id", assignedUserIds);
          
          if (users) {
            usersMap = users.reduce((acc, user) => {
              acc[user.id] = {
                id: user.id,
                email: user.email,
                raw_user_meta_data: { name: user.full_name }
              };
              return acc;
            }, {} as Record<string, any>);
          }
        }

        // Attach related data to tasks
        return data.map(task => ({
          ...task,
          clients: task.client_id ? clientsMap[task.client_id] : null,
          assigned_user: task.assigned_to ? usersMap[task.assigned_to] : null,
        }));
      }

      return data || [];
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: async (): Promise<Task | null> => {
      const { data: task, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching task:", error);
        throw error;
      }

      if (!task) return null;

      // Fetch related client data if exists
      if (task.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("id, name")
          .eq("id", task.client_id)
          .single();
        
        if (client) {
          (task as any).clients = client;
        }
      }

      // Fetch assigned user data if exists
      if (task.assigned_to) {
        const { data: user } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", task.assigned_to)
          .single();
        
        if (user) {
          (task as any).assigned_user = {
            id: user.id,
            email: user.email,
            raw_user_meta_data: { name: user.full_name }
          };
        }
      }

      return task;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: TaskFormData): Promise<Task> => {
      if (!user) throw new Error("User not authenticated");

      console.log("📝 Creating task with data:", data);
      console.log("👤 Current user ID:", user.id);

      const taskData = {
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assigned_to: data.assigned_to || null,
        client_id: data.client_id || null,
        meeting_id: data.meeting_id || null,
        created_by: user.id,
      };

      console.log("💾 Inserting task:", taskData);

      const { data: task, error } = await supabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error("❌ Error creating task:", error);
        throw error;
      }

      console.log("✅ Task created successfully:", task);

      return task;
    },
    onSuccess: (task) => {
      console.log("🔄 Invalidating tasks cache");
      // Invalidate all tasks queries
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // Also refetch immediately
      queryClient.refetchQueries({ queryKey: ["tasks", "list"] });
      
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error: any) => {
      console.error("❌ Task creation failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormData> }): Promise<Task> => {
      const updateData: any = {};
      
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.due_date !== undefined) updateData.due_date = data.due_date || null;
      if (data.assigned_to !== undefined) updateData.assigned_to = data.assigned_to || null;
      if (data.client_id !== undefined) updateData.client_id = data.client_id || null;
      if (data.meeting_id !== undefined) updateData.meeting_id = data.meeting_id || null;

      const { data: task, error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating task:", error);
        throw error;
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting task:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    },
  });
}
