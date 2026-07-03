import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function evalPredicate(
  loan: Record<string, unknown>,
  predicate: Record<string, unknown>,
): boolean {
  const entity = String(predicate.entity ?? "loan");
  const base = entity === "loan" ? loan : loan;
  const path = String(predicate.path ?? "");
  const op = String(predicate.op ?? "exists");
  const val = getPath(base as Record<string, unknown>, path);

  switch (op) {
    case "exists":
      return val != null && String(val).trim() !== "";
    case "gt": {
      const n = Number(predicate.value);
      const v = Number(val);
      return val != null && !Number.isNaN(v) && v > n;
    }
    case "between": {
      const min = Number(predicate.min);
      const max = Number(predicate.max);
      const v = Number(val);
      if (val == null || Number.isNaN(v)) return false;
      return v >= min && v <= max;
    }
    default:
      return true;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const { loan_id } = await req.json();
    if (!loan_id) return jsonResponse({ error: "loan_id required" }, 400);

    const { data: loan, error: loanErr } = await supabase
      .from("loans")
      .select("*")
      .eq("id", loan_id)
      .single();

    if (loanErr || !loan) return jsonResponse({ error: "Loan not found" }, 404);

    const { data: rules } = await supabase
      .from("compliance_rules")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    const loanObj = loan as Record<string, unknown>;
    const results: Array<Record<string, unknown>> = [];

    for (const rule of rules ?? []) {
      const pred = rule.predicate as Record<string, unknown>;
      const pass = evalPredicate(loanObj, pred);
      results.push({
        code: rule.code,
        title: rule.title,
        regulation_tag: rule.regulation_tag,
        severity: rule.severity,
        blocking: rule.blocking,
        pass,
        message: pass ? rule.message_pass : rule.message_fail,
      });
    }

    const failedBlocking = results.some(
      (r) => r.blocking === true && r.pass === false,
    );

    const { error: insErr } = await supabase.from("compliance_rule_runs").insert({
      loan_id,
      results,
      summary: {
        total: results.length,
        passed: results.filter((r) => r.pass).length,
        failed_blocking: failedBlocking,
      },
      run_by: user.id,
    });

    if (insErr) console.error("compliance_rule_runs insert", insErr);

    return jsonResponse({
      loan_id,
      results,
      summary: {
        total: results.length,
        passed: results.filter((r) => r.pass).length,
        failed_blocking: failedBlocking,
      },
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
