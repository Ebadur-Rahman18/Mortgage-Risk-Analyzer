import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface PortalMessageRow {
  id: string;
  loan_id: string;
  borrower_id: string;
  sender_type: "borrower" | "staff";
  sender_user_id: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
}

export const portalMessageKeys = {
  all: ["portal-messages"] as const,
  byLoan: (loanId: string) => [...portalMessageKeys.all, loanId] as const,
};

/** Staff-side: fetch all portal messages for a loan */
export function usePortalMessages(loanId: string | undefined) {
  return useQuery({
    queryKey: portalMessageKeys.byLoan(loanId!),
    enabled: !!loanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_messages")
        .select("*")
        .eq("loan_id", loanId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PortalMessageRow[];
    },
    refetchInterval: 15_000,
  });
}

/** Staff-side: send a message to borrower */
export function useSendStaffMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      loan_id: string;
      borrower_id: string;
      body: string;
      sender_user_id: string;
    }) => {
      const { data, error } = await supabase
        .from("portal_messages")
        .insert({
          loan_id: payload.loan_id,
          borrower_id: payload.borrower_id,
          sender_type: "staff",
          sender_user_id: payload.sender_user_id,
          body: payload.body,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as PortalMessageRow;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: portalMessageKeys.byLoan(vars.loan_id) });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to send message");
    },
  });
}
