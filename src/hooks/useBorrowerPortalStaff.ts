// MCT Lite: hidden-module stub. Original implementation references tables not in the Lite schema.
// @ts-nocheck
import { useQuery } from "@tanstack/react-query";

const noopMutation = {
  mutate: (_variables?: any, options?: any) => options?.onSuccess?.(null),
  mutateAsync: async () => ({ invite_link: "" }),
  isPending: false,
  isLoading: false,
  isError: false,
  isSuccess: false,
  error: null,
  reset: () => {},
};

export function useCreatePortalInvite() {
  return noopMutation;
}

export function useLoanBorrowerUploads(_loanId?: string) {
  return useQuery({
    queryKey: ["borrower-portal-uploads-stub", _loanId],
    queryFn: async () => [],
    enabled: false,
    initialData: [],
  });
}

export function useReviewBorrowerUpload(_loanId?: string) {
  return noopMutation;
}

export async function getBorrowerUploadSignedUrl(_uploadId: string) {
  return { signed_url: "", file_name: "borrower-upload" };
}
