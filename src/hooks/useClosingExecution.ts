import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";

export type SettlementOrderType = "flood" | "title" | "homeowners_insurance" | "other";
export type SettlementOrderStatus =
  | "not_ordered"
  | "ordered"
  | "in_progress"
  | "received"
  | "cleared"
  | "cancelled";

export type AppraisalOrderStatus =
  | "not_ordered"
  | "ordered"
  | "inspection_scheduled"
  | "report_received"
  | "under_review"
  | "accepted"
  | "revisions_requested"
  | "waived"
  | "cancelled";

export type RonSessionStatus =
  | "not_scheduled"
  | "scheduled"
  | "in_session"
  | "completed"
  | "cancelled"
  | "failed";

export type DigitalEcloseStatus =
  | "not_started"
  | "draft"
  | "sent"
  | "borrower_signed"
  | "completed"
  | "n_a";

export type DigitalEnoteStatus =
  | "not_started"
  | "pending"
  | "registered"
  | "n_a"
  | "wet_note";

export type AdverseActionStatus = "draft" | "generated" | "mailed" | "delivered" | "cancelled";
export type AdverseDecision = "denied" | "withdrawn" | "counteroffer_declined" | "other";

export function useSettlementOrders(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.closing.settlementOrders(loanId ?? ""),
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_settlement_orders")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loanId,
  });
}

export function useSettlementOrderMutations(loanId: string) {
  const qc = useQueryClient();
  const insertOne = useMutation({
    mutationFn: async (row: {
      order_type: SettlementOrderType;
      status?: SettlementOrderStatus;
      vendor_name?: string | null;
      notes?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      const { error } = await supabase.from("loan_settlement_orders").insert({
        loan_id: loanId,
        order_type: row.order_type,
        status: row.status ?? "not_ordered",
        vendor_name: row.vendor_name ?? null,
        notes: row.notes ?? null,
        created_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.settlementOrders(loanId) }),
  });

  const updateRow = useMutation({
    mutationFn: async (input: {
      id: string;
      order_type?: SettlementOrderType;
      status?: SettlementOrderStatus;
      vendor_name?: string | null;
      reference_number?: string | null;
      ordered_at?: string | null;
      expected_date?: string | null;
      completed_at?: string | null;
      notes?: string | null;
    }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("loan_settlement_orders")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.settlementOrders(loanId) }),
  });

  const removeRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_settlement_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.settlementOrders(loanId) }),
  });

  return { insertOne, updateRow, removeRow };
}

export function useAppraisalOrders(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.closing.appraisalOrders(loanId ?? ""),
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_appraisal_orders")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loanId,
  });
}

export function useAppraisalOrderMutations(loanId: string) {
  const qc = useQueryClient();
  const insertOne = useMutation({
    mutationFn: async (row: { status?: AppraisalOrderStatus; vendor_name?: string | null; notes?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      const { error } = await supabase.from("loan_appraisal_orders").insert({
        loan_id: loanId,
        status: row.status ?? "not_ordered",
        vendor_name: row.vendor_name ?? null,
        notes: row.notes ?? null,
        created_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.appraisalOrders(loanId) }),
  });

  const updateRow = useMutation({
    mutationFn: async (input: {
      id: string;
      status?: AppraisalOrderStatus;
      vendor_name?: string | null;
      amc_reference?: string | null;
      appraisal_fee?: number | null;
      ordered_at?: string | null;
      inspection_date?: string | null;
      report_received_at?: string | null;
      notes?: string | null;
    }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("loan_appraisal_orders")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.appraisalOrders(loanId) }),
  });

  const removeRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_appraisal_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.appraisalOrders(loanId) }),
  });

  return { insertOne, updateRow, removeRow };
}

export function useRonSessions(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.closing.ronSessions(loanId ?? ""),
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_ron_sessions")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loanId,
  });
}

export function useRonSessionMutations(loanId: string) {
  const qc = useQueryClient();
  const insertOne = useMutation({
    mutationFn: async (row: { status?: RonSessionStatus; vendor_name?: string | null; notes?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      const { error } = await supabase.from("loan_ron_sessions").insert({
        loan_id: loanId,
        status: row.status ?? "not_scheduled",
        vendor_name: row.vendor_name ?? null,
        notes: row.notes ?? null,
        created_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.ronSessions(loanId) }),
  });

  const updateRow = useMutation({
    mutationFn: async (input: {
      id: string;
      status?: RonSessionStatus;
      vendor_name?: string | null;
      provider_session_ref?: string | null;
      scheduled_at?: string | null;
      completed_at?: string | null;
      notes?: string | null;
    }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("loan_ron_sessions")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.ronSessions(loanId) }),
  });

  const removeRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_ron_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.ronSessions(loanId) }),
  });

  return { insertOne, updateRow, removeRow };
}

export function useLoanDigitalClosing(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.closing.digitalClosing(loanId ?? ""),
    queryFn: async () => {
      if (!loanId) return null;
      const { data, error } = await supabase.from("loan_digital_closing").select("*").eq("loan_id", loanId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!loanId,
  });
}

export function useDigitalClosingMutations(loanId: string) {
  const qc = useQueryClient();
  const ensureAndUpdate = useMutation({
    mutationFn: async (payload: {
      eclose_package_status?: DigitalEcloseStatus;
      enote_status?: DigitalEnoteStatus;
      closing_scheduled_date?: string | null;
      closing_completed_at?: string | null;
      package_sent_at?: string | null;
      vendor_name?: string | null;
      notes?: string | null;
    }) => {
      const now = new Date().toISOString();
      const { data: existing, error: exErr } = await supabase
        .from("loan_digital_closing")
        .select("id")
        .eq("loan_id", loanId)
        .maybeSingle();
      if (exErr) throw exErr;
      if (!existing) {
        const { error } = await supabase.from("loan_digital_closing").insert({
          loan_id: loanId,
          updated_at: now,
          ...payload,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loan_digital_closing")
          .update({ ...payload, updated_at: now })
          .eq("loan_id", loanId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.digitalClosing(loanId) }),
  });

  return { ensureAndUpdate };
}

export function useAdverseActions(loanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.closing.adverseActions(loanId ?? ""),
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("loan_adverse_actions")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loanId,
  });
}

export function useAdverseActionMutations(loanId: string) {
  const qc = useQueryClient();
  const insertOne = useMutation({
    mutationFn: async (row: {
      status?: AdverseActionStatus;
      decision?: AdverseDecision | null;
      reason_codes?: string[];
      narrative?: string | null;
      notes?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      const { error } = await supabase.from("loan_adverse_actions").insert({
        loan_id: loanId,
        status: row.status ?? "draft",
        decision: row.decision ?? null,
        reason_codes: row.reason_codes ?? [],
        narrative: row.narrative ?? null,
        notes: row.notes ?? null,
        created_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.adverseActions(loanId) }),
  });

  const updateRow = useMutation({
    mutationFn: async (input: {
      id: string;
      status?: AdverseActionStatus;
      decision?: AdverseDecision | null;
      reason_codes?: string[];
      narrative?: string | null;
      generated_at?: string | null;
      mailed_at?: string | null;
      notes?: string | null;
    }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("loan_adverse_actions")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.adverseActions(loanId) }),
  });

  const removeRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_adverse_actions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.closing.adverseActions(loanId) }),
  });

  return { insertOne, updateRow, removeRow };
}
