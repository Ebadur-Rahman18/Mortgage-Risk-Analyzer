// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
/**
 * Phase 1 — Data Foundation hooks
 * Credit reports, employment verifications, and property valuations.
 * Each supports manual entry (always) and API pull (when integration active).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useIntegrationSetting } from "@/hooks/useIntegrationSettings";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreditReport {
  id: string;
  borrower_id: string;
  loan_id: string | null;
  source: "manual" | "api";
  provider: string | null;
  equifax_score: number | null;
  experian_score: number | null;
  transunion_score: number | null;
  representative_score: number | null;
  total_tradelines: number | null;
  open_tradelines: number | null;
  total_monthly_payments: number | null;
  total_revolving_balance: number | null;
  total_installment_balance: number | null;
  collections_count: number;
  public_records_count: number;
  pull_date: string;
  expiration_date: string | null;
  reference_number: string | null;
  notes: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditReportInsert {
  borrower_id: string;
  loan_id?: string | null;
  source?: "manual" | "api";
  provider?: string | null;
  equifax_score?: number | null;
  experian_score?: number | null;
  transunion_score?: number | null;
  representative_score?: number | null;
  total_tradelines?: number | null;
  open_tradelines?: number | null;
  total_monthly_payments?: number | null;
  total_revolving_balance?: number | null;
  total_installment_balance?: number | null;
  collections_count?: number;
  public_records_count?: number;
  pull_date?: string;
  expiration_date?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  requested_by?: string | null;
}

export interface EmploymentVerification {
  id: string;
  borrower_id: string;
  loan_id: string | null;
  source: "manual" | "api";
  provider: string | null;
  verification_type: "voe" | "voi" | "voe_voi";
  employer_name: string | null;
  employer_address: string | null;
  employer_phone: string | null;
  job_title: string | null;
  employment_status: string | null;
  start_date: string | null;
  end_date: string | null;
  annual_income: number | null;
  monthly_income: number | null;
  pay_frequency: string | null;
  ytd_income: number | null;
  verified: boolean | null;
  verification_date: string | null;
  reference_number: string | null;
  notes: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmploymentVerificationInsert {
  borrower_id: string;
  loan_id?: string | null;
  source?: "manual" | "api";
  provider?: string | null;
  verification_type?: "voe" | "voi" | "voe_voi";
  employer_name?: string | null;
  employer_address?: string | null;
  employer_phone?: string | null;
  job_title?: string | null;
  employment_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  annual_income?: number | null;
  monthly_income?: number | null;
  pay_frequency?: string | null;
  ytd_income?: number | null;
  verified?: boolean | null;
  verification_date?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  requested_by?: string | null;
}

export interface PropertyValuation {
  id: string;
  borrower_id: string | null;
  loan_id: string | null;
  source: "manual" | "api";
  provider: string | null;
  valuation_type: "avm" | "appraisal" | "bpo" | "manual";
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_postal_code: string | null;
  property_type: string | null;
  estimated_value: number | null;
  low_value: number | null;
  high_value: number | null;
  confidence_score: number | null;
  comparable_sales: unknown | null;
  valuation_date: string;
  expiration_date: string | null;
  reference_number: string | null;
  notes: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyValuationInsert {
  borrower_id?: string | null;
  loan_id?: string | null;
  source?: "manual" | "api";
  provider?: string | null;
  valuation_type?: "avm" | "appraisal" | "bpo" | "manual";
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null;
  property_type?: string | null;
  estimated_value?: number | null;
  low_value?: number | null;
  high_value?: number | null;
  confidence_score?: number | null;
  comparable_sales?: unknown | null;
  valuation_date?: string;
  expiration_date?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  requested_by?: string | null;
}

// ─── Consent ────────────────────────────────────────────────────────────────

export type ConsentType = "credit_pull" | "voe_voi" | "avm";

export interface BorrowerConsent {
  id: string;
  borrower_id: string;
  loan_id: string | null;
  consent_type: ConsentType;
  consented: boolean;
  consented_at: string | null;
  consented_by: string | null;
  method: "in_app" | "written" | "verbal" | "esign";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const dataFoundationKeys = {
  creditReports: (borrowerId: string) =>
    ["credit-reports", borrowerId] as const,
  employmentVerifications: (borrowerId: string) =>
    ["employment-verifications", borrowerId] as const,
  propertyValuations: (key: { borrowerId?: string; loanId?: string }) =>
    ["property-valuations", key] as const,
  consents: (borrowerId: string) =>
    ["borrower-consents", borrowerId] as const,
};

// ─── Integration status helpers ─────────────────────────────────────────────

export function useCreditIntegrationStatus() {
  const { data: integration } = useIntegrationSetting("credit-bureau");
  return {
    configured: Boolean(integration?.api_key || integration?.api_key_masked),
    active: Boolean(integration?.is_active),
    integration,
  };
}

export function useVOEIntegrationStatus() {
  const { data: integration } = useIntegrationSetting("voe-provider");
  return {
    configured: Boolean(integration?.api_key || integration?.api_key_masked),
    active: Boolean(integration?.is_active),
    integration,
  };
}

export function useAVMIntegrationStatus() {
  const { data: integration } = useIntegrationSetting("avm-provider");
  return {
    configured: Boolean(integration?.api_key || integration?.api_key_masked),
    active: Boolean(integration?.is_active),
    integration,
  };
}

// ─── Credit Reports ─────────────────────────────────────────────────────────

export function useCreditReports(borrowerId: string | undefined) {
  return useQuery({
    queryKey: dataFoundationKeys.creditReports(borrowerId ?? ""),
    queryFn: async (): Promise<CreditReport[]> => {
      const { data, error } = await supabase
        .from("credit_reports")
        .select("*")
        .eq("borrower_id", borrowerId!)
        .order("pull_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CreditReport[];
    },
    enabled: !!borrowerId,
  });
}

export function useCreateCreditReport() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreditReportInsert) => {
      const { data, error } = await supabase
        .from("credit_reports")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.creditReports(vars.borrower_id),
      });
      toast({ title: "Credit report saved" });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message ?? "Failed to save credit report",
        variant: "destructive",
      });
    },
  });
}

export function usePullCreditReport() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      borrower_id: string;
      loan_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "pull-credit-report",
        { body: params },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.creditReports(vars.borrower_id),
      });
      toast({ title: "Credit report pulled successfully" });
    },
    onError: (e: any) => {
      toast({
        title: "Credit pull failed",
        description: e.message ?? "Could not pull credit report",
        variant: "destructive",
      });
    },
  });
}

// ─── Employment Verifications ───────────────────────────────────────────────

export function useEmploymentVerifications(borrowerId: string | undefined) {
  return useQuery({
    queryKey: dataFoundationKeys.employmentVerifications(borrowerId ?? ""),
    queryFn: async (): Promise<EmploymentVerification[]> => {
      const { data, error } = await supabase
        .from("employment_verifications")
        .select("*")
        .eq("borrower_id", borrowerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmploymentVerification[];
    },
    enabled: !!borrowerId,
  });
}

export function useCreateEmploymentVerification() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: EmploymentVerificationInsert) => {
      const { data, error } = await supabase
        .from("employment_verifications")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.employmentVerifications(vars.borrower_id),
      });
      toast({ title: "Employment verification saved" });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message ?? "Failed to save verification",
        variant: "destructive",
      });
    },
  });
}

export function useVerifyEmployment() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      borrower_id: string;
      loan_id?: string;
      employer_name?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "verify-employment",
        { body: params },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.employmentVerifications(vars.borrower_id),
      });
      toast({ title: "Employment verified successfully" });
    },
    onError: (e: any) => {
      toast({
        title: "Verification failed",
        description: e.message ?? "Could not verify employment",
        variant: "destructive",
      });
    },
  });
}

// ─── Property Valuations ────────────────────────────────────────────────────

export function usePropertyValuations(key: {
  borrowerId?: string;
  loanId?: string;
}) {
  return useQuery({
    queryKey: dataFoundationKeys.propertyValuations(key),
    queryFn: async (): Promise<PropertyValuation[]> => {
      let query = supabase
        .from("property_valuations")
        .select("*")
        .order("valuation_date", { ascending: false });

      if (key.borrowerId) query = query.eq("borrower_id", key.borrowerId);
      if (key.loanId) query = query.eq("loan_id", key.loanId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as PropertyValuation[];
    },
    enabled: !!(key.borrowerId || key.loanId),
  });
}

export function useCreatePropertyValuation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: PropertyValuationInsert) => {
      const { data, error } = await supabase
        .from("property_valuations")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.propertyValuations({
          borrowerId: vars.borrower_id ?? undefined,
          loanId: vars.loan_id ?? undefined,
        }),
      });
      toast({ title: "Property valuation saved" });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message ?? "Failed to save valuation",
        variant: "destructive",
      });
    },
  });
}

export function useRequestAVM() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      borrower_id?: string;
      loan_id?: string;
      property_address: string;
      property_city?: string;
      property_state?: string;
      property_postal_code?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "property-valuation",
        { body: params },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.propertyValuations({
          borrowerId: vars.borrower_id,
          loanId: vars.loan_id,
        }),
      });
      toast({ title: "AVM valuation completed" });
    },
    onError: (e: any) => {
      toast({
        title: "AVM failed",
        description: e.message ?? "Could not get property valuation",
        variant: "destructive",
      });
    },
  });
}

// ─── Delete mutations ───────────────────────────────────────────────────────

export function useDeleteCreditReport() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { id: string; borrower_id: string }) => {
      const { error } = await supabase
        .from("credit_reports")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.creditReports(vars.borrower_id),
      });
      toast({ title: "Credit report deleted" });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message ?? "Failed to delete",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteEmploymentVerification() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { id: string; borrower_id: string }) => {
      const { error } = await supabase
        .from("employment_verifications")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.employmentVerifications(vars.borrower_id),
      });
      toast({ title: "Verification deleted" });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message ?? "Failed to delete",
        variant: "destructive",
      });
    },
  });
}

export function useDeletePropertyValuation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      borrower_id?: string;
      loan_id?: string;
    }) => {
      const { error } = await supabase
        .from("property_valuations")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.propertyValuations({
          borrowerId: vars.borrower_id,
          loanId: vars.loan_id,
        }),
      });
      toast({ title: "Valuation deleted" });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message ?? "Failed to delete",
        variant: "destructive",
      });
    },
  });
}

// ─── Borrower Consent ───────────────────────────────────────────────────────

export function useBorrowerConsents(borrowerId: string | undefined) {
  return useQuery({
    queryKey: dataFoundationKeys.consents(borrowerId ?? ""),
    queryFn: async (): Promise<BorrowerConsent[]> => {
      const { data, error } = await supabase
        .from("borrower_consents")
        .select("*")
        .eq("borrower_id", borrowerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BorrowerConsent[];
    },
    enabled: !!borrowerId,
  });
}

export function useHasConsent(
  borrowerId: string | undefined,
  consentType: ConsentType,
) {
  const { data: consents } = useBorrowerConsents(borrowerId);
  return consents?.some(
    (c) => c.consent_type === consentType && c.consented,
  ) ?? false;
}

export function useRecordConsent() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      borrower_id: string;
      loan_id?: string | null;
      consent_type: ConsentType;
      consented_by: string;
      method?: "in_app" | "written" | "verbal" | "esign";
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("borrower_consents")
        .upsert(
          {
            borrower_id: params.borrower_id,
            loan_id: params.loan_id ?? null,
            consent_type: params.consent_type,
            consented: true,
            consented_at: new Date().toISOString(),
            consented_by: params.consented_by,
            method: params.method ?? "in_app",
            notes: params.notes ?? null,
          } as any,
          { onConflict: "borrower_id,loan_id,consent_type" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: dataFoundationKeys.consents(vars.borrower_id),
      });
      toast({ title: "Consent recorded" });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message ?? "Failed to record consent",
        variant: "destructive",
      });
    },
  });
}

// ─── Dedup helpers ──────────────────────────────────────────────────────────

const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function isRecentPullExists(
  reports: CreditReport[] | undefined,
): boolean {
  if (!reports?.length) return false;
  const latest = reports.find((r) => r.source === "api");
  if (!latest) return false;
  return Date.now() - new Date(latest.pull_date).getTime() < DEDUP_WINDOW_MS;
}

export function isRecentVerifyExists(
  verifications: EmploymentVerification[] | undefined,
): boolean {
  if (!verifications?.length) return false;
  const latest = verifications.find((v) => v.source === "api");
  if (!latest) return false;
  return Date.now() - new Date(latest.created_at).getTime() < DEDUP_WINDOW_MS;
}

export function isRecentAVMExists(
  valuations: PropertyValuation[] | undefined,
): boolean {
  if (!valuations?.length) return false;
  const latest = valuations.find((v) => v.source === "api");
  if (!latest) return false;
  return Date.now() - new Date(latest.valuation_date).getTime() < DEDUP_WINDOW_MS;
}

// ─── Expiration helpers ─────────────────────────────────────────────────────

export function getCreditReportExpirationStatus(
  report: CreditReport,
): "valid" | "expiring_soon" | "expired" | "unknown" {
  if (!report.expiration_date) return "unknown";
  const exp = new Date(report.expiration_date).getTime();
  const now = Date.now();
  if (now > exp) return "expired";
  const daysLeft = (exp - now) / (1000 * 60 * 60 * 24);
  if (daysLeft < 14) return "expiring_soon";
  return "valid";
}
