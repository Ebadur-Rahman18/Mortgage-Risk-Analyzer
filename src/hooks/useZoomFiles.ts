import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { toast as sonnerToast } from "sonner";

export interface ZoomFile {
  id: string;
  meeting_id: string | null;
  file_type: string;
  file_name: string;
  file_size: number | null;
  file_path: string | null;
  storage_path: string | null;
  download_url: string | null;
  transcript_text: string | null;
  transcript_content: unknown;
  is_processed: boolean;
  has_embeddings: boolean;
  processing_status: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

function mapRow(row: Record<string, unknown>): ZoomFile {
  return {
    id: row.id as string,
    meeting_id: (row.meeting_id as string | null) ?? null,
    file_type: (row.file_type as string) || "",
    file_name: (row.file_name as string) || "",
    file_size: row.file_size != null ? Number(row.file_size) : null,
    file_path: (row.file_path as string | null) ?? null,
    storage_path: (row.storage_path as string | null) ?? null,
    download_url: (row.download_url as string | null) ?? null,
    transcript_text: (row.transcript_text as string | null) ?? null,
    transcript_content: row.transcript_content,
    is_processed: Boolean(row.is_processed),
    has_embeddings: Boolean(row.has_embeddings),
    processing_status: (row.processing_status as string) || "pending",
    metadata: row.metadata,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function useZoomFiles(meetingId?: string) {
  return useQuery({
    queryKey: ["zoom-files", meetingId],
    queryFn: async (): Promise<ZoomFile[]> => {
      if (!meetingId) return [];
      const { data, error } = await supabase
        .from("zoom_files")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    },
    enabled: !!meetingId,
  });
}

export function useZoomFile(fileId: string) {
  return useQuery({
    queryKey: ["zoom-files", fileId],
    queryFn: async (): Promise<ZoomFile | null> => {
      const { data, error } = await supabase
        .from("zoom_files")
        .select("*")
        .eq("id", fileId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapRow(data as Record<string, unknown>);
    },
    enabled: !!fileId,
  });
}

export function useUpdateZoomFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ZoomFile> }): Promise<ZoomFile> => {
      void id;
      void data;
      sonnerToast.error("Zoom file updates are not available from the client (service role only).");
      throw new Error("Zoom file updates require server-side tooling");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zoom-files"] });
      toast({
        title: "Success",
        description: "Zoom file updated successfully",
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

export function useDeleteZoomFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      void id;
      sonnerToast.error("Zoom file deletes are not available from the client (service role only).");
      throw new Error("Zoom file deletes require server-side tooling");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zoom-files"] });
      toast({
        title: "Success",
        description: "Zoom file deleted successfully",
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

export function useProcessZoomFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data, error } = await supabase.functions.invoke("zoom-transcript-processing", {
        body: { file_id: fileId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zoom-files"] });
      toast({
        title: "Success",
        description: "Zoom file processing started",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Processing failed: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}
