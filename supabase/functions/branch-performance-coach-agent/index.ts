/**
 * branch-performance-coach-agent — Aggregates per-officer performance metrics
 * for a branch (or org-wide), sends to OpenAI for a coaching narrative + 3
 * recommended actions, persists to branch_coaching_digests, logs ai_agent_runs.
 *
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResp, parseAiJson, normalizeRole, logAgentRun, getUserPersonalizationPrompt } from "../_shared/ai-utils.ts";

const AGENT_SLUG = "branch-performance-coach-agent";

interface OfficerMetrics {
  officer_id: string;
  name: string;
  active_loans: number;
  new_loans_period: number;
  closed_period: number;
  avg_days_in_status: number;
  stuck_over_30d: number;
  stuck_15_30d: number;
  high_risk_count: number;
  critical_risk_count: number;
  pending_conditions: number;
  overdue_milestones: number;
  lock_expiring_7d: number;
  urgent_priority_count: number;
}


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
    const body = (await req.json().catch(() => ({}))) as { branch_id?: string };
    const requestedBranchId = body.branch_id || null;

    const service = createClient(supabaseUrl, serviceKey);

    // Resolve caller role/scope from DB (do not trust client)
    stage = "resolve_scope";
    const [{ data: roleRow }, { data: callerProfile }] = await Promise.all([
      service
        .from("user_roles")
        .select("role, custom_role_id")
        .eq("user_id", uid)
        .maybeSingle(),
      service
        .from("profiles")
        .select("branch_id")
        .eq("id", uid)
        .maybeSingle(),
    ]);

    let customRoleSlug: string | null = null;
    if (roleRow?.custom_role_id) {
      const { data: customRole } = await service
        .from("roles")
        .select("slug")
        .eq("id", roleRow.custom_role_id)
        .maybeSingle();
      customRoleSlug = normalizeRole(customRole?.slug ?? null);
    }

    const appRole = normalizeRole(roleRow?.role ?? null);
    const isAdmin = appRole === "admin";
    const isModerator = appRole === "moderator";
    const isBranchManager = customRoleSlug === "branch_manager";
    const callerBranchId = callerProfile?.branch_id ?? null;

    if (!isAdmin && !isModerator && !isBranchManager) {
      return jsonResp({ error: "Forbidden: insufficient role for Branch Performance Coach Agent." }, 403);
    }

    let branchId: string | null = requestedBranchId;
    if (isBranchManager) {
      if (!callerBranchId) {
        return jsonResp({ error: "Branch manager is not assigned to a branch." }, 400);
      }
      // Enforce branch-only scope for branch managers regardless of request payload.
      branchId = callerBranchId;
    }

    // Check agent is enabled
    stage = "load_agent";
    const { data: agent } = await service
      .from("ai_agents")
      .select("id, system_prompt, is_enabled, provider_config")
      .eq("slug", AGENT_SLUG)
      .maybeSingle();

    if (!agent?.is_enabled) {
      return jsonResp({ error: "Branch Performance Coach Agent is disabled." }, 400);
    }

    // Determine period (last 7 days)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);
    periodStart.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    // Load branch info
    stage = "load_branch";
    let branchName = "Organization";
    if (branchId) {
      const { data: branch } = await service
        .from("branches")
        .select("name")
        .eq("id", branchId)
        .maybeSingle();
      branchName = branch?.name ?? "Unknown Branch";
    }

    // Load loans for the scope
    stage = "load_loans";
    let loansQuery = service
      .from("loans")
      .select("id, loan_number, status, loan_officer_id, created_at, updated_at, lock_expiration_date, branch_id");

    if (branchId) {
      loansQuery = loansQuery.eq("branch_id", branchId);
    }

    const { data: loansData, error: loansErr } = await loansQuery;
    if (loansErr) {
      console.error("Loans error:", loansErr);
      return jsonResp({ error: "Failed to load loans" }, 500);
    }
    const loans = loansData ?? [];

    if (loans.length === 0) {
      return jsonResp({
        error: "No loans found in the specified scope.",
        branch_name: branchName,
      }, 400);
    }

    const loanIds = loans.map((l: any) => l.id);
    const officerIds = [...new Set(loans.map((l: any) => l.loan_officer_id).filter(Boolean))];

    // Load related data in parallel
    stage = "load_relations";
    const [riskRes, conditionsRes, milestonesRes, priorityRes, profilesRes] = await Promise.all([
      service
        .from("loan_risk_scores")
        .select("loan_id, risk_level")
        .in("loan_id", loanIds),
      service
        .from("loan_conditions")
        .select("loan_id, status")
        .in("loan_id", loanIds)
        .in("status", ["pending", "received"]),
      service
        .from("loan_milestones")
        .select("loan_id, due_date, completed_at")
        .in("loan_id", loanIds)
        .is("completed_at", null),
      service
        .from("pipeline_priority_scores")
        .select("loan_id, urgency_score")
        .in("loan_id", loanIds)
        .gte("urgency_score", 60),
      officerIds.length > 0
        ? service
            .from("profiles")
            .select("id, full_name, email")
            .in("id", officerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const riskScores = (riskRes.data ?? []) as { loan_id: string; risk_level: string }[];
    const conditions = (conditionsRes.data ?? []) as { loan_id: string; status: string }[];
    const milestones = (milestonesRes.data ?? []) as { loan_id: string; due_date: string | null; completed_at: string | null }[];
    const priorityScores = (priorityRes.data ?? []) as { loan_id: string; urgency_score: number }[];
    const profiles = (profilesRes.data ?? []) as { id: string; full_name: string | null; email: string | null }[];

    // Build lookup maps
    const riskByLoan = new Map<string, string>();
    for (const r of riskScores) riskByLoan.set(r.loan_id, r.risk_level);

    const conditionsByLoan = new Map<string, number>();
    for (const c of conditions) {
      conditionsByLoan.set(c.loan_id, (conditionsByLoan.get(c.loan_id) ?? 0) + 1);
    }

    const overdueMilestonesByLoan = new Map<string, number>();
    for (const m of milestones) {
      if (m.due_date && new Date(m.due_date) < now && !m.completed_at) {
        overdueMilestonesByLoan.set(m.loan_id, (overdueMilestonesByLoan.get(m.loan_id) ?? 0) + 1);
      }
    }

    const urgentByLoan = new Set(priorityScores.map((p) => p.loan_id));

    const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
    for (const p of profiles) profileMap.set(p.id, p);

    // ── Aggregate per-officer metrics ───────────────────────────────────
    stage = "aggregate_metrics";

    const officerMetricsMap = new Map<string, OfficerMetrics>();

    for (const loan of loans as any[]) {
      const oid = loan.loan_officer_id;
      if (!oid) continue;

      if (!officerMetricsMap.has(oid)) {
        const prof = profileMap.get(oid);
        officerMetricsMap.set(oid, {
          officer_id: oid,
          name: prof?.full_name || prof?.email || "Unknown",
          active_loans: 0,
          new_loans_period: 0,
          closed_period: 0,
          avg_days_in_status: 0,
          stuck_over_30d: 0,
          stuck_15_30d: 0,
          high_risk_count: 0,
          critical_risk_count: 0,
          pending_conditions: 0,
          overdue_milestones: 0,
          lock_expiring_7d: 0,
          urgent_priority_count: 0,
        });
      }

      const m = officerMetricsMap.get(oid)!;

      const isClosed = loan.status === "closed" || loan.status === "funded";
      if (!isClosed) m.active_loans++;

      const createdAt = new Date(loan.created_at);
      if (createdAt >= periodStart && createdAt <= periodEnd) m.new_loans_period++;

      if (isClosed) {
        const updatedAt = new Date(loan.updated_at);
        if (updatedAt >= periodStart && updatedAt <= periodEnd) m.closed_period++;
      }

      // Staleness
      const lastTouch = loan.updated_at ? new Date(loan.updated_at) : createdAt;
      if (!isClosed) {
        if (lastTouch < thirtyDaysAgo) m.stuck_over_30d++;
        else if (lastTouch < fifteenDaysAgo) m.stuck_15_30d++;
      }

      // Risk
      const risk = riskByLoan.get(loan.id);
      if (risk === "high") m.high_risk_count++;
      if (risk === "critical") m.critical_risk_count++;

      // Conditions
      m.pending_conditions += conditionsByLoan.get(loan.id) ?? 0;

      // Milestones
      m.overdue_milestones += overdueMilestonesByLoan.get(loan.id) ?? 0;

      // Lock expiry
      if (loan.lock_expiration_date) {
        const lockDate = new Date(loan.lock_expiration_date);
        if (lockDate >= now && lockDate <= sevenDaysFromNow && !isClosed) {
          m.lock_expiring_7d++;
        }
      }

      // Priority
      if (urgentByLoan.has(loan.id)) m.urgent_priority_count++;
    }

    // Compute avg days in status
    for (const m of officerMetricsMap.values()) {
      const officerLoans = (loans as any[]).filter(
        (l) => l.loan_officer_id === m.officer_id && l.status !== "closed" && l.status !== "funded",
      );
      if (officerLoans.length > 0) {
        const totalDays = officerLoans.reduce((sum: number, l: any) => {
          const last = l.updated_at ? new Date(l.updated_at) : new Date(l.created_at);
          return sum + (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        m.avg_days_in_status = Math.round(totalDays / officerLoans.length);
      }
    }

    const officerMetrics = Array.from(officerMetricsMap.values()).sort(
      (a, b) => b.active_loans - a.active_loans,
    );

    // ── AI enrichment ───────────────────────────────────────────────────
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
      typeof providerConfig.temperature === "number" ? providerConfig.temperature : 0.4;

    // Load user personalization (M3)
    const personalizationPrompt = await getUserPersonalizationPrompt(supabaseUrl!, serviceKey!, agent.id, uid);
    const effectiveSystemPrompt = personalizationPrompt
      ? `${agent.system_prompt}\n\n${personalizationPrompt}`
      : agent.system_prompt;

    let narrative = "";
    let recommendedActions: any[] = [];
    let modelUsed = model;

    const t0 = Date.now();

    if (apiKey) {
      try {
        const payload = {
          branch_name: branchName,
          period: {
            start: periodStart.toISOString().split("T")[0],
            end: periodEnd.toISOString().split("T")[0],
          },
          officer_metrics: officerMetrics,
        };

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
              { role: "user", content: JSON.stringify(payload) },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const raw = aiResult.choices?.[0]?.message?.content ?? "";
          const parsed = parseAiJson<{ narrative: string; recommended_actions: typeof recommendedActions }>(raw);
          if (parsed) {
            narrative = typeof parsed.narrative === "string" ? parsed.narrative : "";
            recommendedActions = Array.isArray(parsed.recommended_actions)
              ? parsed.recommended_actions.slice(0, 3)
              : [];
          } else {
            narrative = raw.slice(0, 5000);
          }
        } else {
          const errText = await aiResponse.text().catch(() => "");
          console.error("OpenAI error:", aiResponse.status, errText);
          await logAgentRun({
            supabaseUrl: Deno.env.get("SUPABASE_URL")!, serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            agentId: agent.id, userId: uid,
            input: `branch-coach branchId=${branchId ?? "org"}`,
            output: null, status: "failed",
            errorMessage: errText.slice(0, 2000),
            latencyMs: Date.now() - t0, modelUsed: model,
          });
          narrative = "AI coaching narrative unavailable — metrics are still valid.";
        }
      } catch (e) {
        console.error("OpenAI error (non-fatal):", e);
        narrative = "AI coaching narrative unavailable — metrics are still valid.";
      }
    } else {
      narrative = "OpenAI not configured — metrics have been aggregated but no coaching narrative is available.";
    }

    const latencyMs = Date.now() - t0;

    // ── Persist digest ──────────────────────────────────────────────────
    stage = "persist";

    const { data: inserted, error: insertErr } = await service
      .from("branch_coaching_digests")
      .insert({
        branch_id: branchId,
        generated_by: uid,
        period_start: periodStart.toISOString().split("T")[0],
        period_end: periodEnd.toISOString().split("T")[0],
        narrative,
        recommended_actions: recommendedActions,
        officer_metrics: officerMetrics,
        ai_model: modelUsed,
        latency_ms: latencyMs,
        metadata: {
          branch_name: branchName,
          total_loans: loans.length,
          total_officers: officerMetrics.length,
        },
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return jsonResp({ error: "Failed to save coaching digest" }, 500);
    }

    // Log agent run
    stage = "log_run";
    try {
      await service.from("ai_agent_runs").insert({
        agent_id: agent.id,
        user_id: uid,
        input: `coaching_digest branch=${branchId ?? "org"}`,
        output: JSON.stringify({
          digest_id: inserted.id,
          officers: officerMetrics.length,
          actions: recommendedActions.length,
        }),
        status: "completed",
        model_used: modelUsed,
        latency_ms: latencyMs,
        metadata: { digest_id: inserted.id },
      });
    } catch {
      // Non-blocking analytics/logging write should not fail the request.
    }

    return jsonResp({
      id: inserted.id,
      branch_id: branchId,
      branch_name: branchName,
      period_start: periodStart.toISOString().split("T")[0],
      period_end: periodEnd.toISOString().split("T")[0],
      narrative,
      recommended_actions: recommendedActions,
      officer_metrics: officerMetrics,
      ai_model: modelUsed,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : null;
    return jsonResp({ error: "Internal server error", stage, message }, 500);
  }
});
