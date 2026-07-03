/**
 * import-compliance-rules — Accepts a JSON payload of compliance rules,
 * validates structure, and upserts into canonical compliance_rules table.
 * Admin-only. Self-contained.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const VALID_GROUPS = ["TRID", "HMDA", "Fair Lending"];
const VALID_OPERATORS = [
  "not_empty",
  "exists",
  "gt",
  "gte",
  "lt",
  "lte",
  "days_from_application_lte",
  "days_before_closing_gte",
  "all_present",
  "within_range_bps",
  "conditional_exists",
  "consistent",
];
const VALID_SEVERITIES = ["fail", "warn"];

interface RulePayload {
  code: string;
  regulation_group?: string;
  name?: string;
  // Canonical deterministic schema
  title?: string;
  regulation_tag?: string;
  severity?: "info" | "warning" | "error";
  blocking?: boolean;
  predicate?: Record<string, unknown>;
  message_pass?: string;
  message_fail?: string;
  sort_order?: number;
  is_active?: boolean;
  // Legacy schema
  description?: string;
  check_field?: string;
  operator?: string;
  threshold?: number | null;
  severity_on_fail: string;
  severity_on_warn?: string | null;
  citation?: string;
  remediation_hint?: string;
  enabled?: boolean;
}

function validateRule(rule: RulePayload, index: number): string | null {
  // Canonical payload support
  if (rule.title || rule.regulation_tag || rule.predicate) {
    if (!rule.code || typeof rule.code !== "string") {
      return `Rule ${index}: "code" is required and must be a string.`;
    }
    if (!rule.title || typeof rule.title !== "string") {
      return `Rule ${index} (${rule.code}): "title" is required for canonical rules.`;
    }
    if (!rule.regulation_tag || typeof rule.regulation_tag !== "string") {
      return `Rule ${index} (${rule.code}): "regulation_tag" is required for canonical rules.`;
    }
    if (!rule.message_fail || typeof rule.message_fail !== "string") {
      return `Rule ${index} (${rule.code}): "message_fail" is required for canonical rules.`;
    }
    return null;
  }

  // Legacy payload support
  if (!rule.code || typeof rule.code !== "string")
    return `Rule ${index}: "code" is required and must be a string.`;
  if (!rule.regulation_group || !VALID_GROUPS.includes(rule.regulation_group))
    return `Rule ${index} (${rule.code}): "regulation_group" must be one of: ${VALID_GROUPS.join(", ")}.`;
  if (!rule.name || typeof rule.name !== "string")
    return `Rule ${index} (${rule.code}): "name" is required.`;
  if (!rule.check_field || typeof rule.check_field !== "string")
    return `Rule ${index} (${rule.code}): "check_field" is required.`;
  if (!VALID_OPERATORS.includes(rule.operator))
    return `Rule ${index} (${rule.code}): "operator" must be one of: ${VALID_OPERATORS.join(", ")}.`;
  if (!VALID_SEVERITIES.includes(rule.severity_on_fail))
    return `Rule ${index} (${rule.code}): "severity_on_fail" must be "fail" or "warn".`;
  if (rule.severity_on_warn != null && rule.severity_on_warn !== "warn")
    return `Rule ${index} (${rule.code}): "severity_on_warn" must be "warn" or null.`;
  return null;
}

function toCanonicalRule(rule: RulePayload, sortOrder: number) {
  if (rule.title || rule.regulation_tag || rule.predicate) {
    return {
      code: rule.code,
      title: rule.title ?? rule.name ?? rule.code,
      regulation_tag: rule.regulation_tag ?? rule.regulation_group ?? "General",
      severity: rule.severity ?? "warning",
      blocking: !!rule.blocking,
      predicate: rule.predicate ?? { entity: "loan", path: "", op: "exists" },
      message_pass: rule.message_pass ?? "Rule passed.",
      message_fail: rule.message_fail ?? "Rule failed.",
      sort_order: Number.isFinite(rule.sort_order) ? Number(rule.sort_order) : sortOrder,
      is_active: rule.is_active ?? rule.enabled ?? true,
    };
  }

  const severityFromLegacy = rule.severity_on_fail === "fail" ? "error" : "warning";
  const blocking = rule.severity_on_fail === "fail";
  const threshold =
    typeof rule.threshold === "number" ? { value: Number(rule.threshold) } : {};
  return {
    code: rule.code,
    title: rule.name ?? rule.code,
    regulation_tag: rule.regulation_group ?? "General",
    severity: severityFromLegacy,
    blocking,
    predicate: {
      entity: "loan",
      path: (rule.check_field ?? "").replace(/^loan:/, ""),
      op: rule.operator ?? "exists",
      ...threshold,
    },
    message_pass: `${rule.name ?? rule.code} passed.`,
    message_fail: rule.description ?? `${rule.name ?? rule.code} failed.`,
    sort_order: sortOrder,
    is_active: rule.enabled !== false,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: "Missing Supabase configuration" }, 500);
    }

    // Auth — admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResp({ error: "Invalid session" }, 401);
    }
    const uid = userData.user.id;

    const service = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();

    const role = (profile?.role ?? "").toLowerCase();
    if (role !== "admin" && role !== "moderator") {
      return jsonResp({ error: "Forbidden — admin role required" }, 403);
    }

    // Parse body
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.rules)) {
      return jsonResp(
        {
          error:
            'Invalid payload. Expected JSON with "rules" array. Example: { "version": "1.0", "rules": [...] }',
        },
        400,
      );
    }

    const rules: RulePayload[] = body.rules;
    if (rules.length === 0) {
      return jsonResp({ error: "No rules provided." }, 400);
    }

    // Validate all rules first
    const errors: string[] = [];
    for (let i = 0; i < rules.length; i++) {
      const err = validateRule(rules[i], i);
      if (err) errors.push(err);
    }
    if (errors.length > 0) {
      return jsonResp({ error: "Validation failed", details: errors }, 400);
    }

    // Upsert canonical deterministic rules
    const upsertRows = rules.map((r, idx) => toCanonicalRule(r, idx + 1));

    const { data: upserted, error: upsertErr } = await service
      .from("compliance_rules")
      .upsert(upsertRows, { onConflict: "code" })
      .select("code, regulation_tag, title, is_active");

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return jsonResp({ error: "Failed to save rules", details: upsertErr.message }, 500);
    }

    return jsonResp({
      message: `Successfully imported ${upserted?.length ?? rules.length} compliance rules.`,
      imported_count: upserted?.length ?? rules.length,
      rules: upserted,
    });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : null;
    return jsonResp({ error: "Internal server error", message }, 500);
  }
});
