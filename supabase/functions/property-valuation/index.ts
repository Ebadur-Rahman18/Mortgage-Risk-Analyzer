/**
 * Property Valuation (AVM) — Phase 1 Data Foundation
 *
 * Workflow:
 *   1. Authenticate caller.
 *   2. Check if avm-provider integration is configured and active.
 *      - If active → call vendor API (stub: returns mock AVM data).
 *      - If not active → reject with helpful message.
 *   3. Store result in property_valuations table.
 *   4. Optionally update loans.appraised_value with estimated value.
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

    const {
      borrower_id,
      loan_id,
      property_address,
      property_city,
      property_state,
      property_postal_code,
    } = await req.json();

    if (!property_address) {
      return jsonResponse({ error: "property_address is required" }, 400);
    }

    // Check integration status
    const { data: integration } = await service
      .from("integration_settings")
      .select("*")
      .eq("provider_name", "avm-provider")
      .maybeSingle();

    if (!integration?.is_active || !integration?.api_key) {
      return jsonResponse(
        {
          error: "AVM integration is not configured or not active. Please configure it in Admin → Integrations → Data Feeds.",
          integration_required: true,
        },
        400,
      );
    }

    // ── Vendor API call (STUB) ──────────────────────────────────────────────
    const config = (integration.config ?? {}) as Record<string, string>;
    const _baseUrl = config.base_url;
    const _apiKey = integration.api_key;

    // Mock AVM response
    const baseValue = 350000 + Math.floor(Math.random() * 300000);
    const variance = Math.floor(baseValue * 0.08);
    const mockValuation = {
      estimated_value: baseValue,
      low_value: baseValue - variance,
      high_value: baseValue + variance,
      confidence_score: 75 + Math.floor(Math.random() * 20),
      comparable_sales: [
        {
          address: "125 Oak Street",
          sale_price: baseValue + Math.floor(Math.random() * 20000) - 10000,
          sale_date: "2025-11-15",
          sqft: 1850,
        },
        {
          address: "340 Elm Avenue",
          sale_price: baseValue + Math.floor(Math.random() * 30000) - 15000,
          sale_date: "2025-10-22",
          sqft: 2100,
        },
        {
          address: "78 Maple Drive",
          sale_price: baseValue + Math.floor(Math.random() * 25000) - 12000,
          sale_date: "2025-09-08",
          sqft: 1920,
        },
      ],
    };

    const valuationRow = {
      borrower_id: borrower_id || null,
      loan_id: loan_id || null,
      source: "api",
      provider: config.provider_name || "avm-vendor",
      valuation_type: "avm",
      property_address,
      property_city: property_city || null,
      property_state: property_state || null,
      property_postal_code: property_postal_code || null,
      estimated_value: mockValuation.estimated_value,
      low_value: mockValuation.low_value,
      high_value: mockValuation.high_value,
      confidence_score: mockValuation.confidence_score,
      comparable_sales: mockValuation.comparable_sales,
      valuation_date: new Date().toISOString(),
      expiration_date: new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      reference_number: `AVM-${Date.now()}`,
      raw_response: { mock: true, ...mockValuation },
      notes: "Auto-valued via AVM integration (mock data)",
      requested_by: user.id,
    };
    // ── End vendor stub ─────────────────────────────────────────────────────

    const { data: valuation, error: insertErr } = await service
      .from("property_valuations")
      .insert(valuationRow)
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Optionally update loan's appraised_value
    if (loan_id) {
      await service
        .from("loans")
        .update({ appraised_value: mockValuation.estimated_value })
        .eq("id", loan_id);
    }

    return jsonResponse({ success: true, valuation });
  } catch (err) {
    console.error("property-valuation error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
