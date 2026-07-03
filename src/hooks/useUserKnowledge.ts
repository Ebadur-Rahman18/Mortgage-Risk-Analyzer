import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface UserKnowledgeFile {
  id: string;
  user_id: string;
  source_id: string | null;
  source_type: string;
  file_name: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  processing_status: string;
  processing_error: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface UserKnowledgeSource {
  id: string;
  user_id: string;
  name: string;
  source_type: string;
  source_identifier: string | null;
  source_url: string | null;
  sync_enabled: boolean;
  sync_frequency: string;
  last_synced_at: string | null;
  sync_status: string;
  file_count: number;
  total_size: number;
  credentials: any;
  sync_config: any;
  metadata: any;
  created_at: string;
  updated_at: string;
}

// NOTE: user_knowledge_files table needs to be created via migration before these hooks will work.
// The migration file exists at: supabase/migrations/20260101_user_knowledge_files.sql
// Until the migration is applied, these hooks will return empty data.

export function useUserKnowledgeFiles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-knowledge-files', user?.id],
    queryFn: async () => {
      // Table may not exist yet - return empty array
      console.warn('user_knowledge_files table not yet available - migration required');
      return [] as UserKnowledgeFile[];
    },
    enabled: !!user,
  });
}

export function useUserKnowledgeSources() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-knowledge-sources', user?.id],
    queryFn: async () => {
      // Table may not exist yet - return empty array
      console.warn('user_knowledge_sources table not yet available - migration required');
      return [] as UserKnowledgeSource[];
    },
    enabled: !!user,
  });
}

export function useUploadUserKnowledgeFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("User not authenticated");

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-knowledge')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Note: File record creation will fail until migration is applied
      toast({
        title: "File Uploaded",
        description: "File uploaded to storage. Database record pending migration.",
      });

      return {
        id: '',
        user_id: user.id,
        source_type: 'upload',
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        processing_status: 'pending',
      } as UserKnowledgeFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-knowledge-files'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteUserKnowledgeFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fileId: string) => {
      // Table may not exist yet
      throw new Error('user_knowledge_files table not yet available - migration required');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-knowledge-files'] });
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCreateUserKnowledgeSource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sourceData: Partial<UserKnowledgeSource>) => {
      // Table may not exist yet
      throw new Error('user_knowledge_sources table not yet available - migration required');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-knowledge-sources'] });
      toast({
        title: "Success",
        description: "Knowledge source created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUserFileStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-file-stats', user?.id],
    queryFn: async () => {
      // Function may not exist yet
      console.warn('get_user_file_stats function not yet available - migration required');
      return {
        total_files: 0,
        total_size: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        by_source: {},
      };
    },
    enabled: !!user,
  });
}
