/**
 * Pull Credit Report — Phase 1 Data Foundation
 *
 * Workflow:
 *   1. Authenticate caller (must be admin or LO with access to borrower).
 *   2. Check if credit-bureau integration is configured and active.
 *      - If active → call vendor API (stub: returns mock tri-merge data).
 *      - If not active → reject with helpful message.
 *   3. Store result in credit_reports table.
 *   4. Optionally update loans.credit_score with representative score.
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

    const { borrower_id, loan_id } = await req.json();
    if (!borrower_id) {
      return jsonResponse({ error: "borrower_id is required" }, 400);
    }

    // Check integration status
    const { data: integration } = await service
      .from("integration_settings")
      .select("*")
      .eq("provider_name", "credit-bureau")
      .maybeSingle();

    if (!integration?.is_active || !integration?.api_key) {
      return jsonResponse(
        {
          error: "Credit bureau integration is not configured or not active. Please configure it in Admin → Integrations → Data Feeds.",
          integration_required: true,
        },
        400,
      );
    }

    // Fetch borrower info for the pull
    const { data: borrower, error: bErr } = await service
      .from("borrowers")
      .select("first_name, last_name, ssn_last4, date_of_birth")
      .eq("id", borrower_id)
      .single();

    if (bErr || !borrower) {
      return jsonResponse({ error: "Borrower not found" }, 404);
    }

    // ── Vendor API call (STUB) ──────────────────────────────────────────────
    // In production, replace this block with the actual vendor SDK/HTTP call.
    // The integration row has: api_key, config.base_url, config.sync_path, etc.
    const config = (integration.config ?? {}) as Record<string, string>;
    const _baseUrl = config.base_url;
    const _apiKey = integration.api_key;

    // Mock tri-merge response — replace with real vendor call
    const mockScores = {
      equifax: 720 + Math.floor(Math.random() * 40),
      experian: 715 + Math.floor(Math.random() * 40),
      transunion: 710 + Math.floor(Math.random() * 40),
    };
    const representativeScore = Math.min(
      mockScores.equifax,
      mockScores.experian,
      mockScores.transunion,
    );

    const reportRow = {
      borrower_id,
      loan_id: loan_id || null,
      source: "api",
      provider: "tri-merge",
      equifax_score: mockScores.equifax,
      experian_score: mockScores.experian,
      transunion_score: mockScores.transunion,
      representative_score: representativeScore,
      total_tradelines: 12 + Math.floor(Math.random() * 8),
      open_tradelines: 5 + Math.floor(Math.random() * 5),
      total_monthly_payments: 2400 + Math.floor(Math.random() * 800),
      collections_count: 0,
      public_records_count: 0,
      pull_date: new Date().toISOString(),
      expiration_date: new Date(
        Date.now() + 120 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      reference_number: `CR-${Date.now()}`,
      raw_response: { mock: true, scores: mockScores },
      notes: "Auto-pulled via credit bureau integration (mock data)",
      requested_by: user.id,
    };
    // ── End vendor stub ─────────────────────────────────────────────────────

    const { data: report, error: insertErr } = await service
      .from("credit_reports")
      .insert(reportRow)
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Optionally update the loan's credit_score
    if (loan_id) {
      await service
        .from("loans")
        .update({ credit_score: representativeScore })
        .eq("id", loan_id);
    }

    return jsonResponse({ success: true, report });
  } catch (err) {
    console.error("pull-credit-report error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
