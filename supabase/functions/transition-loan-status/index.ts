/**
 * Transition Loan Status — validates stage transition, updates status,
 * auto-creates milestones, and records timeline events.
 *
 * Body: { loan_id: string, to_status: string }
 */

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { loan_id, to_status } = await req.json();
    if (!loan_id || !to_status) {
      return jsonResponse({ error: "loan_id and to_status are required" }, 400);
    }

    const { data: loan, error: loanErr } = await supabase
      .from("loans")
      .select("id, status, loan_officer_id, underwriter_id")
      .eq("id", loan_id)
      .single();
    if (loanErr || !loan) return jsonResponse({ error: "Loan not found" }, 404);

    const fromStatus = loan.status;
    const allowedWhenBlocked = new Set(["denied", "withdrawn", "suspended"]);

    const { data: latestRun } = await supabase
      .from("compliance_rule_runs")
      .select("summary, run_at")
      .eq("loan_id", loan_id)
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const summary = (latestRun?.summary ?? {}) as Record<string, unknown>;
    const failedBlocking = summary.failed_blocking === true;
    if (failedBlocking && !allowedWhenBlocked.has(to_status)) {
      return jsonResponse({
        error:
          "Status transition blocked by failed compliance checks. Re-run compliance rules and resolve blocking failures before progressing the loan.",
        blocked_by_compliance: true,
        latest_compliance_run_at: latestRun?.run_at ?? null,
      }, 409);
    }

    const { data: transition, error: transErr } = await supabase
      .from("loan_stage_transitions")
      .select("*")
      .eq("from_status", fromStatus)
      .eq("to_status", to_status)
      .maybeSingle();

    if (transErr || !transition) {
      return jsonResponse({
        error: `Invalid transition: ${fromStatus} → ${to_status}`,
      }, 400);
    }

    if (transition.required_role) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = new Set((roles ?? []).map((r: { role: string }) => r.role));

      const role = transition.required_role;
      let hasRole = userRoles.has("admin") || userRoles.has(role);

      if (role === "loan_officer") {
        hasRole = hasRole || loan.loan_officer_id === user.id;
      }
      if (role === "underwriter") {
        hasRole = hasRole || loan.underwriter_id === user.id;
      }

      if (!hasRole) {
        return jsonResponse({
          error: `Role '${role}' required for this transition`,
        }, 403);
      }
    }

    const { error: updateErr } = await supabase
      .from("loans")
      .update({ status: to_status })
      .eq("id", loan_id);

    if (updateErr) {
      return jsonResponse({ error: updateErr.message }, 500);
    }

    if (transition.auto_milestone) {
      await supabase.from("loan_milestones").insert({
        loan_id,
        milestone_type: transition.auto_milestone,
        name: transition.label || `${transition.auto_milestone}`,
        completed_at: new Date().toISOString(),
        created_by: user.id,
      });
    }

    return jsonResponse({
      success: true,
      from_status: fromStatus,
      to_status,
      milestone_created: transition.auto_milestone || null,
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});
