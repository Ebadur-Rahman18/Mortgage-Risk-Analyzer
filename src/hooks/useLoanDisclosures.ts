import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface LoanDisclosure {
  id: string;
  loan_id: string;
  borrower_id: string;
  disclosure_type: string;
  title: string;
  status: "pending" | "sent" | "viewed" | "signed" | "declined";
  envelope_id: string | null;
  signing_url: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const disclosureKeys = {
  all: ["loan-disclosures"] as const,
  byLoan: (loanId: string) => [...disclosureKeys.all, loanId] as const,
};

export function useLoanDisclosures(loanId: string | undefined) {
  return useQuery({
    queryKey: disclosureKeys.byLoan(loanId!),
    enabled: !!loanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_disclosures")
        .select("*")
        .eq("loan_id", loanId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanDisclosure[];
    },
  });
}

export function useSendDisclosureForSigning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      loan_id: string;
      disclosure_type: string;
      title: string;
      document_base64?: string;
      document_name?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("docusign-send-envelope", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.disclosure;
    },
    onSuccess: (_d, vars) => {
      toast.success("Disclosure sent for signing");
      qc.invalidateQueries({ queryKey: disclosureKeys.byLoan(vars.loan_id) });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to send disclosure");
    },
  });
}
