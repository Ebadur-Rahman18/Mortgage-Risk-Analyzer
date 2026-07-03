import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { logCrud } from "@/lib/activity-logger";

export interface DocumentType {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface LoanDocument {
  id: string;
  loan_id: string;
  borrower_id: string | null;
  document_type_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  source: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  loan_condition_id: string | null;
  version: number;
  parent_document_id: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  document_types?: DocumentType;
}

export interface ProgramDocRequirement {
  id: string;
  program_id: string;
  document_type_id: string;
  is_required: boolean;
  description: string | null;
  sort_order: number;
  document_types?: DocumentType;
}

const docKeys = {
  types: ["document_types"] as const,
  byLoan: (loanId: string) => ["loan_documents", loanId] as const,
  pendingReview: ["loan_documents", "pending_review"] as const,
  checklist: (loanId: string) => ["loan_doc_checklist", loanId] as const,
  requirements: (programId: string) => ["program_doc_requirements", programId] as const,
};

export function useDocumentTypes() {
  return useQuery({
    queryKey: docKeys.types,
    queryFn: async (): Promise<DocumentType[]> => {
      const { data, error } = await supabase
        .from("document_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as DocumentType[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useLoanDocuments(loanId: string | undefined) {
  return useQuery({
    queryKey: docKeys.byLoan(loanId ?? ""),
    queryFn: async (): Promise<LoanDocument[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*, document_types(*)")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanDocument[];
    },
    enabled: !!loanId,
  });
}

export function usePendingDocumentReviews() {
  return useQuery({
    queryKey: docKeys.pendingReview,
    queryFn: async (): Promise<LoanDocument[]> => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*, document_types(*)")
        .eq("review_status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LoanDocument[];
    },
  });
}

export function useProgramDocRequirements(programId: string | undefined | null) {
  return useQuery({
    queryKey: docKeys.requirements(programId ?? ""),
    queryFn: async (): Promise<ProgramDocRequirement[]> => {
      if (!programId) return [];
      const { data, error } = await supabase
        .from("program_document_requirements")
        .select("*, document_types(*)")
        .eq("program_id", programId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ProgramDocRequirement[];
    },
    enabled: !!programId,
  });
}

export function useUploadLoanDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      loanId: string;
      borrowerId?: string;
      documentTypeId: string;
      file: File;
      conditionId?: string;
      source?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const timestamp = Date.now();
      const filePath = `${input.loanId}/${timestamp}-${input.file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, input.file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("loan_documents")
        .insert({
          loan_id: input.loanId,
          borrower_id: input.borrowerId ?? null,
          document_type_id: input.documentTypeId,
          file_name: input.file.name,
          file_path: filePath,
          file_size: input.file.size,
          mime_type: input.file.type,
          source: input.source ?? "manual",
          review_status: "pending",
          loan_condition_id: input.conditionId ?? null,
          uploaded_by: user?.id ?? null,
        })
        .select("*, document_types(*)")
        .single();
      if (error) throw error;
      return data as LoanDocument;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: docKeys.byLoan(data.loan_id) });
      qc.invalidateQueries({ queryKey: docKeys.pendingReview });
      logCrud("create", "document", data.id, {
        loan_id: data.loan_id,
        file_name: data.file_name,
      });
      toast.success("Document uploaded");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useReviewLoanDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; loanId: string; status: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("loan_documents")
        .update({
          review_status: input.status,
          review_notes: input.notes ?? null,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, v) => {
      qc.invalidateQueries({ queryKey: docKeys.byLoan(v.loanId) });
      qc.invalidateQueries({ queryKey: docKeys.pendingReview });
      logCrud("update", "document", v.id, {
        loan_id: v.loanId,
        status: v.status,
        review_status: (data as { review_status?: string } | null)?.review_status ?? v.status,
      });
      toast.success(`Document ${v.status}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteLoanDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, loanId, filePath }: { id: string; loanId: string; filePath: string }) => {
      await supabase.storage.from("loan-documents").remove([filePath]);
      const { error } = await supabase.from("loan_documents").delete().eq("id", id);
      if (error) throw error;
      return { id, loanId };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: docKeys.byLoan(v.loanId) });
      qc.invalidateQueries({ queryKey: docKeys.pendingReview });
      logCrud("delete", "document", v.id, { loan_id: v.loanId });
      toast.success("Document deleted");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function getLoanDocumentSignedUrl(filePath: string): Promise<string> {
  return supabase.storage
    .from("loan-documents")
    .createSignedUrl(filePath, 3600)
    .then(({ data, error }) => {
      if (error) throw error;
      return data.signedUrl;
    });
}
