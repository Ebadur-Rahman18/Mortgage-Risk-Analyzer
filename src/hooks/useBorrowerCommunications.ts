// MCT Lite: hidden-module stub. Original implementation references tables not in the Lite schema.
// @ts-nocheck
import { useQuery } from "@tanstack/react-query";

export type BorrowerCommStatus = "draft" | "approved" | "sent" | "rejected" | "needs_revision";
export type BorrowerCommunicationListRow = {
  id: string;
  loan_id: string;
  borrower_id?: string | null;
  doc_type: string;
  channel: string;
  audience: string;
  status: BorrowerCommStatus;
  draft_content: string;
  confidence?: string | null;
  missing_data_notes?: unknown;
  created_at: string;
  sent_at?: string | null;
  loans?: { loan_number?: string | null; borrowers?: { first_name?: string | null; last_name?: string | null } | null } | null;
};

const noopMutation = {
  mutate: (_variables?: any, options?: any) => options?.onSuccess?.(null),
  mutateAsync: async () => ({ id: "" }),
  isPending: false,
  isLoading: false,
  isError: false,
  isSuccess: false,
  error: null,
  reset: () => {},
};

function useEmptyCommunicationsQuery(key: unknown[]) {
  return useQuery({ queryKey: key, queryFn: async () => [], enabled: false, initialData: [] });
}

export function useBorrowerCommunicationsList(_filter?: BorrowerCommStatus | "all") {
  return useEmptyCommunicationsQuery(["borrower-communications-stub", "list", _filter ?? "all"]);
}

export function useBorrowerCommunicationsByLoan(_loanId?: string) {
  return useEmptyCommunicationsQuery(["borrower-communications-stub", "loan", _loanId ?? ""]);
}

export function useBorrowerCommunicationsByBorrower(_borrowerId?: string) {
  return useEmptyCommunicationsQuery(["borrower-communications-stub", "borrower", _borrowerId ?? ""]);
}

export function useGenerateBorrowerCommunication() { return noopMutation; }
export function useUpdateBorrowerCommunicationDraft() { return noopMutation; }
export function useBorrowerCommunicationLifecycle() { return noopMutation; }
export function useSendBorrowerEmail() { return noopMutation; }
