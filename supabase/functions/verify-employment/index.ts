/**
 * Verify Employment — Phase 1 Data Foundation
 *
 * Workflow:
 *   1. Authenticate caller.
 *   2. Check if voe-provider integration is configured and active.
 *      - If active → call vendor API (stub: returns mock VOE/VOI data).
 *      - If not active → reject with helpful message.
 *   3. Store result in employment_verifications table.
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const service = createClient(supabaseUrl, serviceKey);

    const { borrower_id, loan_id, employer_name } = await req.json();
    if (!borrower_id) {
      return jsonResponse({ error: "borrower_id is required" }, 400);
    }

    // Check integration status
    const { data: integration } = await service
      .from("integration_settings")
      .select("*")
      .eq("provider_name", "voe-provider")
      .maybeSingle();

    if (!integration?.is_active || !integration?.api_key) {
      return jsonResponse(
        {
          error: "VOE/VOI integration is not configured or not active. Please configure it in Admin → Integrations → Data Feeds.",
          integration_required: true,
        },
        400,
      );
    }

    // Fetch borrower
    const { data: borrower, error: bErr } = await service
      .from("borrowers")
      .select("first_name, last_name, ssn_last4")
      .eq("id", borrower_id)
      .single();

    if (bErr || !borrower) {
      return jsonResponse({ error: "Borrower not found" }, 404);
    }

    // ── Vendor API call (STUB) ──────────────────────────────────────────────
    const config = (integration.config ?? {}) as Record<string, string>;
    const _baseUrl = config.base_url;
    const _apiKey = integration.api_key;

    // Mock VOE/VOI response
    const mockVerification = {
      employer_name: employer_name || "Acme Corporation",
      employer_address: "123 Business Ave, New York, NY 10001",
      employer_phone: "(555) 123-4567",
      job_title: "Software Engineer",
      employment_status: "active" as const,
      start_date: "2020-03-15",
      annual_income: 95000,
      monthly_income: 7916.67,
      pay_frequency: "biweekly" as const,
      ytd_income: 47500,
    };

    const verificationRow = {
      borrower_id,
      loan_id: loan_id || null,
      source: "api",
      provider: config.provider_name || "the-work-number",
      verification_type: "voe_voi",
      ...mockVerification,
      verified: true,
      verification_date: new Date().toISOString(),
      reference_number: `VOE-${Date.now()}`,
      raw_response: { mock: true, ...mockVerification },
      notes: "Auto-verified via VOE/VOI integration (mock data)",
      requested_by: user.id,
    };
    // ── End vendor stub ─────────────────────────────────────────────────────

    const { data: verification, error: insertErr } = await service
      .from("employment_verifications")
      .insert(verificationRow)
      .select()
      .single();

    if (insertErr) throw insertErr;

    return jsonResponse({ success: true, verification });
  } catch (err) {
    console.error("verify-employment error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
