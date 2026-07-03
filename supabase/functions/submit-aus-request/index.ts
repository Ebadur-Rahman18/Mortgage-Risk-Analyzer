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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const { loan_id, provider } = await req.json();
    if (!loan_id || !provider) {
      return jsonResponse({ error: "loan_id and provider required (du|lp)" }, 400);
    }

    const p = String(provider).toLowerCase();
    if (p !== "du" && p !== "lp" && p !== "other") {
      return jsonResponse({ error: "provider must be du, lp, or other" }, 400);
    }

    const { data: integ } = await supabase
      .from("integration_settings")
      .select("is_active")
      .eq("provider_name", p === "du" ? "aus-fannie-du" : "aus-freddie-lp")
      .maybeSingle();

    const integrationEnabled = integ?.is_active === true;

    const { data: loan } = await supabase
      .from("loans")
      .select("id, loan_number, loan_officer_id, underwriter_id")
      .eq("id", loan_id)
      .single();

    if (!loan) return jsonResponse({ error: "Loan not found" }, 404);

    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAdminRole =
      (prof?.role ?? "").toLowerCase() === "admin" ||
      (userRoles ?? []).some((r: { role: string }) => String(r.role).toLowerCase() === "admin");

    const allowed =
      loan.loan_officer_id === user.id ||
      loan.underwriter_id === user.id ||
      hasAdminRole;
    if (!allowed) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const stubResponse = {
      status: integrationEnabled ? "submitted" : "stub_pending",
      mode: integrationEnabled ? "integration_configured_stub" : "stub_only",
      message: integrationEnabled
        ? "Request recorded — live AUS response pending vendor wiring."
        : "AUS integration disabled — stub submission only.",
      action_required: integrationEnabled
        ? "Complete vendor API wiring and map AUS response payloads."
        : "Enable AUS provider integration in Admin > Data Feeds for live submission.",
      recommendation: "Refer / ineligible / approve (sample)",
      findings: [],
    };

    const { data: row, error } = await supabase
      .from("aus_submissions")
      .insert({
        loan_id,
        provider: p === "other" ? "other" : p,
        status: integrationEnabled ? "submitted" : "stub_pending",
        request_payload: { loan_id, provider: p, user_id: user.id },
        response_payload: stubResponse,
        external_ref: integrationEnabled ? null : "STUB",
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({
      submission: row,
      stub: !integrationEnabled,
      mode: integrationEnabled ? "integration_configured_stub" : "stub_only",
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
