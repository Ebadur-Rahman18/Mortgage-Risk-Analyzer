/**
 * Check Eligibility — evaluates a loan scenario against all active programs.
 *
 * Accepts either loan_id (auto-pulls data from Phase 1 tables and loan record)
 * or a manual scenario object.
 *
 * Body: { loan_id?: string, scenario?: { credit_score, ltv, dti, loan_amount, property_type, occupancy_type, state } }
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

interface Scenario {
  credit_score: number;
  ltv: number;
  dti: number;
  loan_amount: number;
  property_type: string;
  occupancy_type: string;
  state: string;
}

interface ProgramGuidelines {
  fico_ltv_matrix?: { min_fico: number; max_ltv: number }[];
  property_types?: string[];
  occupancy_types?: string[];
  max_dti?: number;
  min_reserves_months?: number;
  mi_required_above_ltv?: number;
  documentation_types?: string[];
}

function evaluateProgramEligibility(
  program: { program_name: string; program_code: string; min_credit_score: number | null; max_ltv: number | null; max_dti: number | null; loan_limit: number | null; guidelines: ProgramGuidelines | null; product_name?: string },
  scenario: Scenario
): { status: "eligible" | "ineligible" | "eligible_with_conditions"; reasons: string[]; conditions: string[] } {
  const reasons: string[] = [];
  const conditions: string[] = [];
  const g = program.guidelines ?? {};

  if (g.fico_ltv_matrix && g.fico_ltv_matrix.length > 0) {
    const match = g.fico_ltv_matrix.find(
      (tier) => scenario.credit_score >= tier.min_fico && scenario.ltv <= tier.max_ltv
    );
    if (!match) {
      reasons.push(`FICO ${scenario.credit_score} / LTV ${scenario.ltv}% does not meet any matrix tier`);
    }
  } else {
    if (program.min_credit_score && scenario.credit_score < program.min_credit_score) {
      reasons.push(`FICO ${scenario.credit_score} below minimum ${program.min_credit_score}`);
    }
    if (program.max_ltv && scenario.ltv > Number(program.max_ltv)) {
      reasons.push(`LTV ${scenario.ltv}% exceeds maximum ${program.max_ltv}%`);
    }
  }

  const maxDti = g.max_dti ?? (program.max_dti ? Number(program.max_dti) : null);
  if (maxDti && scenario.dti > maxDti) {
    reasons.push(`DTI ${scenario.dti}% exceeds maximum ${maxDti}%`);
  }

  if (program.loan_limit && scenario.loan_amount > Number(program.loan_limit)) {
    reasons.push(`Loan amount $${scenario.loan_amount.toLocaleString()} exceeds limit $${Number(program.loan_limit).toLocaleString()}`);
  }

  if (g.property_types && g.property_types.length > 0) {
    const normalized = scenario.property_type?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
    if (normalized && !g.property_types.includes(normalized)) {
      reasons.push(`Property type "${scenario.property_type}" not eligible`);
    }
  }

  if (g.occupancy_types && g.occupancy_types.length > 0) {
    const normalized = scenario.occupancy_type?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
    if (normalized && !g.occupancy_types.includes(normalized)) {
      reasons.push(`Occupancy "${scenario.occupancy_type}" not eligible`);
    }
  }

  if (reasons.length > 0) {
    return { status: "ineligible", reasons, conditions: [] };
  }

  if (g.mi_required_above_ltv != null && scenario.ltv > g.mi_required_above_ltv) {
    conditions.push(`Mortgage insurance required (LTV > ${g.mi_required_above_ltv}%)`);
  }
  if (g.min_reserves_months && g.min_reserves_months > 0) {
    conditions.push(`${g.min_reserves_months} months reserves required`);
  }

  if (conditions.length > 0) {
    return { status: "eligible_with_conditions", reasons: [], conditions };
  }

  return { status: "eligible", reasons: [], conditions: [] };
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

    const body = await req.json();
    let scenario: Scenario;

    if (body.loan_id) {
      const { data: loan } = await supabase
        .from("loans")
        .select("*, borrowers(*)")
        .eq("id", body.loan_id)
        .single();

      if (!loan) return jsonResponse({ error: "Loan not found" }, 404);

      let creditScore = loan.credit_score;
      const { data: latestCredit } = await supabase
        .from("credit_reports")
        .select("representative_score")
        .eq("borrower_id", loan.borrower_id)
        .order("pulled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestCredit?.representative_score) {
        creditScore = latestCredit.representative_score;
      }

      let propertyValue = loan.appraised_value;
      const { data: latestAVM } = await supabase
        .from("property_valuations")
        .select("estimated_value")
        .eq("borrower_id", loan.borrower_id)
        .order("valuation_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestAVM?.estimated_value) {
        propertyValue = latestAVM.estimated_value;
      }

      const ltv = propertyValue && loan.loan_amount
        ? (Number(loan.loan_amount) / Number(propertyValue)) * 100
        : loan.ltv ?? 0;

      scenario = {
        credit_score: creditScore ?? 0,
        ltv: Number(ltv),
        dti: Number(loan.dti ?? 0),
        loan_amount: Number(loan.loan_amount ?? 0),
        property_type: loan.purpose ?? "",
        occupancy_type: loan.occupancy_type ?? "",
        state: loan.property_state ?? "",
      };
    } else if (body.scenario) {
      scenario = body.scenario;
    } else {
      return jsonResponse({ error: "loan_id or scenario required" }, 400);
    }

    const { data: programs } = await supabase
      .from("loan_programs")
      .select("*, loan_products(product_name, product_type)")
      .eq("is_active", true);

    const results = (programs ?? []).map((prog: any) => {
      const result = evaluateProgramEligibility(
        {
          ...prog,
          product_name: prog.loan_products?.product_name,
        },
        scenario
      );
      return {
        program_id: prog.id,
        program_code: prog.program_code,
        program_name: prog.program_name,
        product_name: prog.loan_products?.product_name,
        product_type: prog.loan_products?.product_type,
        ...result,
      };
    });

    results.sort((a: any, b: any) => {
      const order = { eligible: 0, eligible_with_conditions: 1, ineligible: 2 };
      return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
    });

    return jsonResponse({
      scenario,
      results,
      eligible_count: results.filter((r: any) => r.status !== "ineligible").length,
      total_programs: results.length,
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});
