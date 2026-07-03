import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const COMPLIANCE_RULES_TABLE = "compliance_rules";

export interface ComplianceRule {
  id: string;
  code: string;
  regulation_group: string; // maps to regulation_tag in canonical table
  name: string; // maps to title in canonical table
  description: string | null;
  check_field: string; // derived from predicate
  operator: string;
  threshold: number | null;
  severity_on_fail: string; // derived from severity/blocking
  severity_on_warn: string | null;
  citation: string | null;
  remediation_hint: string | null;
  enabled: boolean; // maps to is_active
  created_at: string;
  updated_at?: string;
  updated_by?: string | null;
}

const keys = {
  all: ["compliance_rules"] as const,
};

type CanonicalRuleRow = {
  id: string;
  code: string;
  title: string;
  regulation_tag: string;
  severity: "info" | "warning" | "error";
  blocking: boolean;
  predicate: Record<string, unknown> | null;
  message_fail: string;
  is_active: boolean;
  created_at: string;
};

function deriveThreshold(predicate: Record<string, unknown> | null): number | null {
  if (!predicate) return null;
  if (typeof predicate.value === "number") return predicate.value;
  if (typeof predicate.max === "number") return predicate.max;
  if (typeof predicate.min === "number") return predicate.min;
  return null;
}

function normalizeSeverity(rule: CanonicalRuleRow): string {
  if (rule.blocking || rule.severity === "error") return "fail";
  return "warn";
}

function mapCanonicalRule(rule: CanonicalRuleRow): ComplianceRule {
  const path = typeof rule.predicate?.path === "string" ? rule.predicate.path : "";
  const operator = typeof rule.predicate?.op === "string" ? rule.predicate.op : "exists";
  return {
    id: rule.id,
    code: rule.code,
    regulation_group: rule.regulation_tag,
    name: rule.title,
    description: rule.message_fail ?? null,
    check_field: path || "loan:unknown",
    operator,
    threshold: deriveThreshold(rule.predicate),
    severity_on_fail: normalizeSeverity(rule),
    severity_on_warn: rule.severity === "warning" ? "warn" : null,
    citation: null,
    remediation_hint: null,
    enabled: rule.is_active,
    created_at: rule.created_at,
  };
}

export function useComplianceRules() {
  return useQuery({
    queryKey: keys.all,
    queryFn: async (): Promise<ComplianceRule[]> => {
      const { data, error } = await supabase
        .from(COMPLIANCE_RULES_TABLE)
        .select("id, code, title, regulation_tag, severity, blocking, predicate, message_fail, is_active, created_at")
        .order("regulation_tag")
        .order("code");
      if (error) throw error;
      return ((data ?? []) as CanonicalRuleRow[]).map(mapCanonicalRule);
    },
  });
}

export function useToggleComplianceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from(COMPLIANCE_RULES_TABLE)
        .update({ is_active: enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to update rule");
    },
  });
}

export function useUpdateComplianceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Partial<ComplianceRule> & { id: string }) => {
      const { id, ...updates } = rule;
      const patch: Record<string, unknown> = {};
      if (typeof updates.name === "string") patch.title = updates.name;
      if (typeof updates.description === "string") patch.message_fail = updates.description;
      if (typeof updates.regulation_group === "string") patch.regulation_tag = updates.regulation_group;
      if (typeof updates.enabled === "boolean") patch.is_active = updates.enabled;
      if (typeof updates.severity_on_fail === "string") {
        patch.severity = updates.severity_on_fail === "fail" ? "error" : "warning";
        patch.blocking = updates.severity_on_fail === "fail";
      }
      const { error } = await supabase
        .from(COMPLIANCE_RULES_TABLE)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success("Rule updated");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to update rule");
    },
  });
}

export function useImportComplianceRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jsonPayload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke(
        "import-compliance-rules",
        { body: jsonPayload },
      );
      if (error) {
        let msg = error.message || "Import failed";
        if (error instanceof Response) {
          try {
            const j = await error.json();
            if (j?.error) msg = j.error;
          } catch {
            /* ignore */
          }
        }
        throw new Error(msg);
      }
      if (data?.error) {
        const details = data.details
          ? Array.isArray(data.details)
            ? data.details.join("\n")
            : String(data.details)
          : "";
        throw new Error(`${data.error}${details ? `\n${details}` : ""}`);
      }
      return data as { message: string; imported_count: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success(data.message);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to import rules");
    },
  });
}
