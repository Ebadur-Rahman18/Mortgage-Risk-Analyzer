import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface Borrower {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  ssn_last4: string | null;
  date_of_birth: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  /** Legacy scaffold column; prefer street_address after migration. */
  address_line1?: string | null;
  /** Legacy scaffold column; prefer postal_code after migration. */
  zip_code?: string | null;
  data_source: string | null;
  external_id: string | null;
  api_payload: Json | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BorrowerInsert {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  ssn_last4?: string | null;
  date_of_birth?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  data_source?: string | null;
  external_id?: string | null;
  api_payload?: Json | null;
}

export const BORROWERS_PAGE_SIZE = 25;

export interface BorrowersPaginatedResult {
  rows: Borrower[];
  totalCount: number;
}

/** Loan form dropdown: first N borrowers visible to RLS (avoids pagination bug). */
export function useBorrowersForSelect(limit = 500) {
  return useQuery({
    queryKey: [...queryKeys.borrowers.all, "select-options", limit] as const,
    queryFn: async (): Promise<
      Pick<Borrower, "id" | "first_name" | "last_name" | "email">[]
    > => {
      const { data, error } = await supabase
        .from("borrowers")
        .select("id, first_name, last_name, email")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Pick<Borrower, "id" | "first_name" | "last_name" | "email">[];
    },
  });
}

export function useBorrowers(filters?: { search?: string; page?: number }) {
  const page = filters?.page ?? 1;

  return useQuery({
    queryKey: queryKeys.borrowers.list({ search: filters?.search, page }),
    queryFn: async (): Promise<BorrowersPaginatedResult> => {
      const from = (page - 1) * BORROWERS_PAGE_SIZE;
      const to = from + BORROWERS_PAGE_SIZE - 1;

      let query = supabase
        .from("borrowers")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as Borrower[], totalCount: count ?? 0 };
    },
  });
}

export function useBorrower(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.borrowers.detail(id ?? ""),
    queryFn: async (): Promise<Borrower | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("borrowers")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Borrower;
    },
    enabled: !!id,
  });
}

export function useCreateBorrower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      createdByUserId,
    }: {
      input: BorrowerInsert;
      createdByUserId?: string | null;
    }) => {
      const userId =
        createdByUserId ??
        (await supabase.auth.getUser()).data.user?.id ??
        null;
      const { data, error } = await supabase
        .from("borrowers")
        .insert({
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone: input.phone,
          ssn_last4: input.ssn_last4,
          date_of_birth: input.date_of_birth,
          street_address: input.street_address,
          city: input.city,
          state: input.state,
          postal_code: input.postal_code,
          data_source: input.data_source ?? "manual",
          external_id: input.external_id,
          api_payload: input.api_payload,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Borrower;
    },
    onSuccess: () => {
      invalidateKeys.borrowers(queryClient);
      toast.success("Borrower created");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateBorrower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BorrowerInsert> }) => {
      const { data: out, error } = await supabase
        .from("borrowers")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return out as Borrower;
    },
    onSuccess: () => {
      invalidateKeys.borrowers(queryClient);
      toast.success("Borrower updated");
    },
    onError: (e) => toast.error(e.message),
  });
}
