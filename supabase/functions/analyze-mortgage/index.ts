/**
 * analyze-mortgage — AI Risk Copilot structured risk analysis for a loan.
 * Uses Google Gemini via routedChatCompletion; persists append-only rows.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResp,
  parseAiJson,
  routedChatCompletion,
  type ChatMessage,
} from "../_shared/ai-utils.ts";
import { assertLoanOfficerAccess, createServiceClient } from "../_shared/loan-access.ts";

const AGENT_SLUG = "analyze-mortgage";

interface AnalysisResult {
  riskScore: number;
  riskLevel: "High" | "Medium" | "Low";
  summary: string;
  riskFactors: string[];
  recommendations: string[];
}

function computeDti(monthlyDebt: number | null, annualIncome: number | null): number | null {
  if (monthlyDebt == null || annualIncome == null || annualIncome <= 0) return null;
  const monthlyIncome = annualIncome / 12;
  if (monthlyIncome <= 0) return null;
  return Math.round((monthlyDebt / monthlyIncome) * 10000) / 100;
}

function computeLtv(loanAmount: number | null, propertyValue: number | null): number | null {
  if (loanAmount == null || propertyValue == null || propertyValue <= 0) return null;
  return Math.round((loanAmount / propertyValue) * 10000) / 100;
}

function normalizeRiskLevel(level: string): "high" | "medium" | "low" {
  const l = level.toLowerCase();
  if (l === "high") return "high";
  if (l === "medium") return "medium";
  return "low";
}

function validateAnalysisResult(raw: AnalysisResult): AnalysisResult {
  const score = Math.min(100, Math.max(0, Math.round(Number(raw.riskScore) || 0)));
  const level = normalizeRiskLevel(String(raw.riskLevel ?? "medium"));
  return {
    riskScore: score,
    riskLevel: level === "high" ? "High" : level === "medium" ? "Medium" : "Low",
    summary: String(raw.summary ?? "").trim() || "Analysis completed.",
    riskFactors: Array.isArray(raw.riskFactors) ? raw.riskFactors.map(String) : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations.map(String) : [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const started = Date.now();
  let stage = "init";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return jsonResp({ error: "Missing Supabase configuration" }, 500);
    }

    stage = "auth";
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

    stage = "parse_body";
    const body = (await req.json().catch(() => ({}))) as { loan_id?: string };
    if (!body.loan_id) {
      return jsonResp({ error: "loan_id is required" }, 400);
    }
    const loan_id = body.loan_id;

    const service = createServiceClient();

    stage = "access";
    const access = await assertLoanOfficerAccess(userClient, service, uid, loan_id);
    if (!access.ok) {
      return jsonResp({ error: access.message }, access.status);
    }

    stage = "load_loan";
    const { data: loan, error: loanErr } = await service
      .from("loans")
      .select(`
        *,
        borrowers(first_name, last_name, email, phone)
      `)
      .eq("id", loan_id)
      .maybeSingle();

    if (loanErr || !loan) {
      return jsonResp({ error: "Loan not found" }, 404);
    }

    const { data: documents } = await service
      .from("loan_documents")
      .select("file_name, document_types(name, code)")
      .eq("loan_id", loan_id);

    const borrower = loan.borrowers as {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
    } | null;

    const dti = computeDti(
      loan.monthly_debt != null ? Number(loan.monthly_debt) : null,
      loan.annual_income != null ? Number(loan.annual_income) : null,
    ) ?? (loan.dti != null ? Number(loan.dti) : null);

    const ltv = computeLtv(
      loan.loan_amount != null ? Number(loan.loan_amount) : null,
      loan.appraised_value != null ? Number(loan.appraised_value) : null,
    ) ?? (loan.ltv != null ? Number(loan.ltv) : null);

    const docSummary = (documents ?? []).map((d: Record<string, unknown>) => {
      const types = d.document_types as { name?: string; code?: string } | null;
      return `${types?.name ?? "Document"}: ${d.file_name}`;
    });

    const contextBlock = JSON.stringify({
      borrower: {
        name: borrower ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") : null,
        email: borrower?.email,
        phone: borrower?.phone,
      },
      loan: {
        loan_number: loan.loan_number,
        status: loan.status,
        loan_amount: loan.loan_amount,
        loan_type: loan.loan_type,
        interest_rate: loan.interest_rate,
        loan_term_months: loan.loan_term_months,
        appraised_value: loan.appraised_value,
        down_payment: loan.down_payment,
        annual_income: loan.annual_income,
        monthly_debt: loan.monthly_debt,
        employment_years: loan.employment_years,
        credit_score: loan.credit_score,
        property_address: loan.property_address,
        property_city: loan.property_city,
        property_state: loan.property_state,
        property_postal_code: loan.property_postal_code,
      },
      calculated: { dti, ltv },
      documents: docSummary,
    }, null, 2);

    const systemPrompt = `You are an expert mortgage underwriter performing a risk assessment.
Analyze the mortgage application data and uploaded document list provided.
Use the calculated DTI and LTV when present; otherwise infer risk from available fields.

Respond with ONLY a JSON object (no markdown fences):
{
  "riskScore": <number 0-100>,
  "riskLevel": "High" | "Medium" | "Low",
  "summary": "<2-4 sentence executive summary>",
  "riskFactors": ["<factor 1>", "<factor 2>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>"]
}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Mortgage application data:\n${contextBlock}` },
    ];

    stage = "ai_call";
    const aiResult = await routedChatCompletion(messages, {
      provider: "google",
      model: "gemini-2.5-flash",
      temperature: 0.2,
      max_tokens: 4096,
    });

    stage = "parse";
    const parsed = validateAnalysisResult(parseAiJson<AnalysisResult>(aiResult.output));
    const latency_ms = Date.now() - started;

    stage = "persist";
    const { data: inserted, error: insertErr } = await service
      .from("loan_risk_analyses")
      .insert({
        loan_id,
        run_by: uid,
        risk_score: parsed.riskScore,
        risk_level: normalizeRiskLevel(parsed.riskLevel),
        summary: parsed.summary,
        risk_factors: parsed.riskFactors,
        recommendations: parsed.recommendations,
        dti,
        ltv,
        model_used: aiResult.model ?? "gemini-2.5-flash",
        latency_ms,
        is_outdated: false,
      })
      .select()
      .single();

    if (insertErr) {
      return jsonResp({ error: insertErr.message }, 500);
    }

    return jsonResp({
      analysis: {
        id: inserted.id,
        riskScore: parsed.riskScore,
        riskLevel: parsed.riskLevel,
        summary: parsed.summary,
        riskFactors: parsed.riskFactors,
        recommendations: parsed.recommendations,
        dti,
        ltv,
        model_used: inserted.model_used,
        created_at: inserted.created_at,
        is_outdated: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error(`[${AGENT_SLUG}] ${stage}:`, message);
    return jsonResp({ error: message, stage }, 500);
  }
});
