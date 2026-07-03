/**
 * compliance-screening-agent — Reads rules from canonical compliance_rules,
 * evaluates each rule against the loan data, calls OpenAI for
 * remediation enrichment, persists results to compliance_screenings,
 * and logs in ai_agent_runs.
 *
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResp, parseAiJson, normalizeRole as normRole, logAgentRun, getUserPersonalizationPrompt } from "../_shared/ai-utils.ts";
import {
  type CheckResult,
  type ComplianceCheckItem,
  type ComplianceRule,
  type CanonicalRule,
  type EvalContext,
  type RateTier,
  mapCanonicalToLegacyShape,
  evaluateRule,
} from "../_shared/compliance-rule-engine.ts";

async function assertComplianceScreeningAccess(
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
  userId: string,
  loanId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { data: roleRows } = await userClient.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((roleRows ?? []).map((r: { role: string }) => normRole(r.role)));

  const { data: prof } = await serviceClient
    .from("profiles")
    .select("role, branch_id")
    .eq("id", userId)
    .maybeSingle();
  if (prof?.role) roles.add(normRole(prof.role as string));

  if (roles.has("admin") || roles.has("moderator")) {
    return { ok: true };
  }

  if (roles.has("branch_manager")) {
    const { data: loan, error } = await serviceClient
      .from("loans")
      .select("branch_id")
      .eq("id", loanId)
      .maybeSingle();
    if (error || !loan) return { ok: false, status: 404, message: "Loan not found" };
    if (prof?.branch_id && loan.branch_id === prof.branch_id) {
      return { ok: true };
    }
    return {
      ok: false,
      status: 403,
      message: "You can only run compliance screening for loans in your branch.",
    };
  }

  return {
    ok: false,
    status: 403,
    message: "Compliance screening is not available for your role.",
  };
}


const AGENT_SLUG = "compliance-screening-agent";

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let stage = "init";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: "Missing Supabase configuration" }, 500);
    }

    // Auth
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

    // Parse body
    stage = "parse_body";
    const body = (await req.json().catch(() => ({}))) as { loan_id?: string };
    if (!body.loan_id) {
      return jsonResp({ error: "loan_id is required" }, 400);
    }
    const loan_id = body.loan_id;

    const service = createClient(supabaseUrl, serviceKey);

    stage = "access";
    const access = await assertComplianceScreeningAccess(userClient, service, uid, loan_id);
    if (!access.ok) {
      return jsonResp({ error: access.message }, access.status);
    }

    // Check agent is enabled
    stage = "load_agent";
    const { data: agent } = await service
      .from("ai_agents")
      .select("id, system_prompt, is_enabled, provider_config")
      .eq("slug", AGENT_SLUG)
      .maybeSingle();

    if (!agent?.is_enabled) {
      return jsonResp({ error: "Compliance Screening Agent is disabled." }, 400);
    }

    // Load compliance rules (enabled only, canonical deterministic schema)
    stage = "load_rules";
    const { data: rulesData, error: rulesErr } = await service
      .from("compliance_rules")
      .select("code, title, regulation_tag, severity, blocking, predicate, message_fail")
      .eq("is_active", true)
      .order("sort_order");

    if (rulesErr || !rulesData || rulesData.length === 0) {
      return jsonResp({ error: "No compliance rules found or error loading rules." }, 500);
    }
    const rules = (rulesData as CanonicalRule[]).map(mapCanonicalToLegacyShape);

    // Load loan
    stage = "load_loan";
    const { data: loan, error: loanErr } = await service
      .from("loans")
      .select("id, loan_number, status, loan_amount, appraised_value, ltv, credit_score, dti, purpose, occupancy_type, lock_date, lock_expiration_date, loan_officer_id, borrower_id, property_address, property_city, property_state, property_postal_code, branch_id, created_at")
      .eq("id", loan_id)
      .maybeSingle();

    if (loanErr || !loan) {
      return jsonResp({ error: "Loan not found" }, 404);
    }

    // Load related data in parallel (rate_tier_config added for L6 configurable rate tiers)
    stage = "load_relations";
    const [borrowerRes, milestonesRes, timelineRes, rateLockRes, rateTiersRes] = await Promise.all([
      loan.borrower_id
        ? service
            .from("borrowers")
            .select("first_name, last_name, email, phone, hmda_race, hmda_ethnicity, hmda_sex, hmda_income")
            .eq("id", loan.borrower_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      service
        .from("loan_milestones")
        .select("milestone_type, name, completed_at, due_date, created_at")
        .eq("loan_id", loan_id),
      service
        .from("loan_timeline_events")
        .select("event_type, description, created_at")
        .eq("loan_id", loan_id)
        .order("created_at", { ascending: false })
        .limit(200),
      service
        .from("rate_locks")
        .select("locked_rate, lock_date, expiration_date")
        .eq("loan_id", loan_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Load configurable rate tiers (L6); falls back to DEFAULT_RATE_TIERS if table missing
      service
        .from("rate_tier_config")
        .select("min_credit_score, expected_rate")
        .eq("is_active", true)
        .order("min_credit_score", { ascending: false }),
    ]);

    const borrower = borrowerRes.data as Record<string, unknown> | null;
    const milestones = (milestonesRes.data ?? []) as {
      milestone_type: string;
      completed_at: string | null;
      created_at: string;
    }[];
    const timelineEvents = (timelineRes.data ?? []) as {
      event_type: string;
      description: string | null;
      created_at: string;
    }[];
    const rateLock = rateLockRes.data as { locked_rate: number | null } | null;
    // Use DB tiers when available; evaluateRule falls back to DEFAULT_RATE_TIERS when undefined
    const rateTiers = (rateTiersRes.data && rateTiersRes.data.length > 0)
      ? rateTiersRes.data as RateTier[]
      : undefined;

    const creditScore = loan.credit_score != null ? Number(loan.credit_score) : null;

    // ── Evaluate all rules ──────────────────────────────────────────────
    stage = "evaluate_rules";

    const evalCtx: EvalContext = {
      loan: loan as unknown as Record<string, unknown>,
      borrower,
      milestones,
      timelineEvents,
      rateLock,
      creditScore,
      rateTiers,
    };

    const checks: ComplianceCheckItem[] = rules.map((rule) => evaluateRule(rule, evalCtx));

    const passCount = checks.filter((c) => c.result === "pass").length;
    const warnCount = checks.filter((c) => c.result === "warning").length;
    const failCount = checks.filter((c) => c.result === "fail").length;
    const overall: CheckResult = failCount > 0 ? "fail" : warnCount > 0 ? "warning" : "pass";

    // ── AI enrichment ───────────────────────────────────────────────────
    let aiSummary = "";
    let aiGroupAssessments: Record<string, string> = {};
    let aiRemediations: { code: string; recommendation: string; citation_ref: string; urgency: string }[] = [];
    let modelUsed = "";

    stage = "ai_enrichment";
    const { data: openaiSetting } = await service
      .from("integration_settings")
      .select("api_key, is_active")
      .eq("provider_name", "openai")
      .maybeSingle();

    const apiKey = openaiSetting?.api_key || Deno.env.get("OPENAI_API_KEY");
    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || "gpt-4o-mini";
    const temperature =
      typeof providerConfig.temperature === "number" ? providerConfig.temperature : 0.2;
    modelUsed = model;

    // Load user personalization (M3)
    const personalizationPrompt = await getUserPersonalizationPrompt(supabaseUrl!, serviceKey!, agent.id, uid);
    const effectiveSystemPrompt = personalizationPrompt
      ? `${agent.system_prompt}\n\n${personalizationPrompt}`
      : agent.system_prompt;

    const t0 = Date.now();

    if (apiKey) {
      try {
        const checksForAi = checks.map(
          ({ code, regulation_group, name, result, actual_value, issue_note, citation }) => ({
            code,
            regulation_group,
            name,
            result,
            actual_value,
            issue_note,
            citation,
          }),
        );

        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: 3000,
            messages: [
              { role: "system", content: effectiveSystemPrompt },
              {
                role: "user",
                content: `Loan: ${loan.loan_number ?? loan_id}\nStatus: ${loan.status}\nOverall: ${overall} (${passCount} pass, ${warnCount} warning, ${failCount} fail)\n\nChecks:\n${JSON.stringify(checksForAi, null, 2)}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const raw = aiResult.choices?.[0]?.message?.content ?? "";
          const parsed = parseAiJson<{
            summary: string;
            group_assessments: Record<string, string>;
            remediations: { code: string; recommendation: string; citation_ref: string; urgency: string }[];
          }>(raw);
          if (parsed) {
            aiSummary = typeof parsed.summary === "string" ? parsed.summary : "";
            aiGroupAssessments = typeof parsed.group_assessments === "object" && parsed.group_assessments
              ? parsed.group_assessments as Record<string, string>
              : {};
            aiRemediations = Array.isArray(parsed.remediations) ? parsed.remediations : [];
            for (const rem of aiRemediations) {
              const check = checks.find((c) => c.code === rem.code);
              if (check) check.remediation = rem.recommendation;
            }
          } else {
            aiSummary = raw.slice(0, 3000);
          }
        } else {
          const errText = await aiResponse.text().catch(() => "");
          console.error("OpenAI error:", errText);
          await logAgentRun({
            supabaseUrl: Deno.env.get("SUPABASE_URL")!, serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            agentId: agent.id, userId: uid,
            input: `compliance-screening loan=${loan_id}`,
            output: null, status: "failed",
            errorMessage: errText.slice(0, 2000),
            latencyMs: Date.now() - t0, modelUsed: modelUsed,
          });
          aiSummary = "AI summary unavailable — rule-based results are still valid.";
        }
      } catch (e) {
        console.error("OpenAI error (non-fatal):", e);
        aiSummary = "AI summary unavailable — rule-based results are still valid.";
      }
    } else {
      aiSummary = "OpenAI not configured — deterministic compliance checks completed.";
    }

    const latencyMs = Date.now() - t0;

    // ── Persist result ──────────────────────────────────────────────────
    stage = "persist";
    const { data: inserted, error: insertErr } = await service
      .from("compliance_screenings")
      .insert({
        loan_id,
        run_by: uid,
        overall_result: overall,
        pass_count: passCount,
        warn_count: warnCount,
        fail_count: failCount,
        checks,
        ai_summary: aiSummary,
        ai_remediation: aiRemediations,
        model_used: modelUsed,
        latency_ms: latencyMs,
        metadata: {
          loan_number: loan.loan_number,
          borrower_name: borrower
            ? `${borrower.first_name ?? ""} ${borrower.last_name ?? ""}`.trim()
            : null,
          group_assessments: aiGroupAssessments,
        },
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return jsonResp({ error: "Failed to save compliance screening" }, 500);
    }

    // Log agent run
    stage = "log_run";
    await service
      .from("ai_agent_runs")
      .insert({
        agent_id: agent.id,
        user_id: uid,
        input: `compliance_screen loan=${loan_id}`,
        output: JSON.stringify({
          screening_id: inserted.id,
          overall,
          passCount,
          warnCount,
          failCount,
        }),
        status: "completed",
        model_used: modelUsed,
        latency_ms: latencyMs,
        metadata: { screening_id: inserted.id },
      })
      .catch(() => {});

    return jsonResp({
      id: inserted.id,
      loan_id,
      overall_result: overall,
      pass_count: passCount,
      warn_count: warnCount,
      fail_count: failCount,
      checks,
      ai_summary: aiSummary,
      ai_remediation: aiRemediations,
      group_assessments: aiGroupAssessments,
      model_used: modelUsed,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : null;
    return jsonResp({ error: "Internal server error", stage, message }, 500);
  }
});
