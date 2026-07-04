import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import { extractEdgeFunctionErrorMessage } from "@/lib/edgeFunctionUtils";

export interface RiskChatMessage {
  id: string;
  loan_id: string;
  role: "user" | "assistant";
  content: string;
  created_by: string | null;
  created_at: string;
}

export function useMortgageRiskChatHistory(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.loanRiskChat.byLoan(loanId ?? ""),
    queryFn: async (): Promise<RiskChatMessage[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_risk_chat_messages")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RiskChatMessage[];
    },
    enabled: !!loanId,
  });
}

export function useSendMortgageRiskChat(loanId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: string) => {
      if (!loanId) throw new Error("Loan ID required");
      const { data, error } = await supabase.functions.invoke("mortgage-chat", {
        body: { loan_id: loanId, message },
      });
      if (error) {
        throw new Error(await extractEdgeFunctionErrorMessage(error, data));
      }
      const body = data as { error?: string; message?: string };
      if (body?.error) throw new Error(body.error);
      return body.message ?? "";
    },
    onSuccess: () => {
      if (loanId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loanRiskChat.byLoan(loanId) });
      }
    },
    onError: (e) => toast.error(e.message),
  });
}
