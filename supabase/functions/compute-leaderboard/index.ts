/**
 * compute-leaderboard — Aggregates officer performance metrics, computes
 * composite scores, assigns ranks, and awards badges.
 * Self-contained — no _shared/ imports.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRole(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getISOWeekLabel(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getMonthLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function weekDateRange(weekLabel: string): { start: Date; end: Date } {
  const [yearStr, wStr] = weekLabel.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  const start = new Date(mondayOfWeek1);
  start.setUTCDate(start.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function monthDateRange(monthLabel: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = monthLabel.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

interface OfficerScore {
  user_id: string;
  name: string;
  branch_id: string | null;
  closed_count: number;
  pipeline_volume: number;
  on_time_rate: number;
  conditions_speed_avg_days: number;
  composite_score: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: "Missing Supabase configuration" }, 500);
    }

    // Auth
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

    const body = (await req.json().catch(() => ({}))) as {
      period_type?: string;
      period_label?: string;
    };

    const periodType = body.period_type === "monthly" ? "monthly" : "weekly";
    const now = new Date();
    const periodLabel =
      body.period_label ||
      (periodType === "weekly" ? getISOWeekLabel(now) : getMonthLabel(now));

    const service = createClient(supabaseUrl, serviceKey);

    // Resolve role
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

    if (!isAdmin && !isModerator && !isBranchManager) {
      return jsonResp({ error: "Forbidden: requires admin or branch_manager role" }, 403);
    }

    // Determine date range
    const { start: periodStart, end: periodEnd } =
      periodType === "weekly"
        ? weekDateRange(periodLabel)
        : monthDateRange(periodLabel);

    const periodStartISO = periodStart.toISOString();
    const periodEndISO = periodEnd.toISOString();

    // Scope — branch managers only see their branch
    let branchFilter: string | null = null;
    if (isBranchManager && !isAdmin && !isModerator) {
      branchFilter = callerProfile?.branch_id ?? null;
      if (!branchFilter) {
        return jsonResp({ error: "Branch manager not assigned to a branch" }, 400);
      }
    }

    // Load all loans
    let loansQuery = service
      .from("loans")
      .select("id, loan_number, status, loan_officer_id, loan_amount, updated_at, branch_id");
    if (branchFilter) {
      loansQuery = loansQuery.eq("branch_id", branchFilter);
    }

    const { data: allLoans, error: loansErr } = await loansQuery;
    if (loansErr) {
      console.error("Loans error:", loansErr);
      return jsonResp({ error: "Failed to load loans" }, 500);
    }
    const loans = allLoans ?? [];
    if (loans.length === 0) {
      return jsonResp({ error: "No loans found", period_label: periodLabel }, 400);
    }

    const loanIds = loans.map((l: any) => l.id);
    const officerIds = [...new Set(loans.map((l: any) => l.loan_officer_id).filter(Boolean))] as string[];

    if (officerIds.length === 0) {
      return jsonResp({ error: "No officers found for loans", period_label: periodLabel }, 400);
    }

    // Load related data in parallel
    const [riskRes, conditionsRes, profilesRes] = await Promise.all([
      service
        .from("loan_risk_scores")
        .select("loan_id, risk_level")
        .in("loan_id", loanIds),
      service
        .from("loan_conditions")
        .select("loan_id, status, created_at, received_at")
        .in("loan_id", loanIds),
      service
        .from("profiles")
        .select("id, full_name, email, branch_id")
        .in("id", officerIds),
    ]);

    const riskMap = new Map<string, string[]>();
    for (const r of riskRes.data ?? []) {
      const arr = riskMap.get(r.loan_id) ?? [];
      arr.push(r.risk_level);
      riskMap.set(r.loan_id, arr);
    }

    const conditionsByLoan = new Map<string, any[]>();
    for (const c of conditionsRes.data ?? []) {
      const arr = conditionsByLoan.get(c.loan_id) ?? [];
      arr.push(c);
      conditionsByLoan.set(c.loan_id, arr);
    }

    const profileMap = new Map<string, any>();
    for (const p of profilesRes.data ?? []) {
      profileMap.set(p.id, p);
    }

    // Compute per-officer metrics
    const officerScores: OfficerScore[] = [];

    for (const officerId of officerIds) {
      const officerLoans = loans.filter((l: any) => l.loan_officer_id === officerId);
      const profile = profileMap.get(officerId);
      const name = profile?.full_name || profile?.email || officerId.slice(0, 8);
      const officerBranchId = profile?.branch_id ?? null;

      // 1. Closed count in period
      const closedInPeriod = officerLoans.filter(
        (l: any) =>
          (l.status === "closed" || l.status === "funded") &&
          l.updated_at >= periodStartISO &&
          l.updated_at <= periodEndISO,
      );
      const closedCount = closedInPeriod.length;

      // 2. Pipeline volume (active loans)
      const activeLoans = officerLoans.filter(
        (l: any) => l.status !== "closed" && l.status !== "funded" && l.status !== "cancelled",
      );
      const pipelineVolume = activeLoans.reduce(
        (sum: number, l: any) => sum + (parseFloat(l.loan_amount) || 0),
        0,
      );

      // 3. On-time rate (closed loans with no high/critical risk)
      let onTimeRate = 0;
      if (closedInPeriod.length > 0) {
        const onTimeCount = closedInPeriod.filter((l: any) => {
          const risks = riskMap.get(l.id) ?? [];
          return !risks.some((r: string) => r === "high" || r === "critical");
        }).length;
        onTimeRate = (onTimeCount / closedInPeriod.length) * 100;
      }

      // 4. Conditions cleared speed (avg days from created to received)
      const officerLoanIds = officerLoans.map((l: any) => l.id);
      const clearedConditions: number[] = [];
      for (const lid of officerLoanIds) {
        for (const c of conditionsByLoan.get(lid) ?? []) {
          if (c.received_at && c.created_at) {
            const days =
              (new Date(c.received_at).getTime() - new Date(c.created_at).getTime()) /
              (1000 * 60 * 60 * 24);
            if (days >= 0) clearedConditions.push(days);
          }
        }
      }
      const conditionsSpeedAvgDays =
        clearedConditions.length > 0
          ? clearedConditions.reduce((a, b) => a + b, 0) / clearedConditions.length
          : 0;

      // Composite score (weighted 0-100)
      // Normalize each sub-score: higher is better
      const closedNorm = Math.min(closedCount / 10, 1) * 100;
      const pipelineNorm = Math.min(pipelineVolume / 5000000, 1) * 100;
      const onTimeNorm = onTimeRate;
      const speedNorm =
        conditionsSpeedAvgDays > 0
          ? Math.max(0, 100 - (conditionsSpeedAvgDays / 10) * 100)
          : 50;

      const compositeScore =
        closedNorm * 0.3 +
        pipelineNorm * 0.25 +
        onTimeNorm * 0.25 +
        speedNorm * 0.2;

      officerScores.push({
        user_id: officerId,
        name,
        branch_id: officerBranchId,
        closed_count: closedCount,
        pipeline_volume: Math.round(pipelineVolume * 100) / 100,
        on_time_rate: Math.round(onTimeRate * 100) / 100,
        conditions_speed_avg_days: Math.round(conditionsSpeedAvgDays * 100) / 100,
        composite_score: Math.round(compositeScore * 100) / 100,
      });
    }

    // Sort by composite score descending and assign ranks
    officerScores.sort((a, b) => b.composite_score - a.composite_score);
    officerScores.forEach((s, i) => {
      (s as any).rank = i + 1;
    });

    // Get previous period label for prev_rank
    let prevPeriodLabel: string | null = null;
    if (periodType === "weekly") {
      const prevWeek = new Date(periodStart);
      prevWeek.setDate(prevWeek.getDate() - 7);
      prevPeriodLabel = getISOWeekLabel(prevWeek);
    } else {
      const prevMonth = new Date(periodStart);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      prevPeriodLabel = getMonthLabel(prevMonth);
    }

    // Load previous scores for prev_rank
    const { data: prevScores } = await service
      .from("leaderboard_scores")
      .select("user_id, rank")
      .eq("period_type", periodType)
      .eq("period_label", prevPeriodLabel);

    const prevRankMap = new Map<string, number>();
    for (const ps of prevScores ?? []) {
      prevRankMap.set(ps.user_id, ps.rank);
    }

    // Upsert leaderboard_scores
    const upsertRows = officerScores.map((s) => ({
      user_id: s.user_id,
      period_type: periodType,
      period_label: periodLabel,
      closed_count: s.closed_count,
      pipeline_volume: s.pipeline_volume,
      on_time_rate: s.on_time_rate,
      conditions_speed_avg_days: s.conditions_speed_avg_days,
      composite_score: s.composite_score,
      rank: (s as any).rank,
      prev_rank: prevRankMap.get(s.user_id) ?? null,
      branch_id: s.branch_id,
      scored_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await service
      .from("leaderboard_scores")
      .upsert(upsertRows, { onConflict: "user_id,period_type,period_label" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return jsonResp({ error: "Failed to save scores" }, 500);
    }

    // Award badges
    const { data: badgeDefs } = await service
      .from("badge_definitions")
      .select("*")
      .eq("is_active", true);

    const { data: existingBadges } = await service
      .from("officer_badges")
      .select("user_id, badge_definition_id, period_label")
      .in("user_id", officerIds);

    const existingSet = new Set(
      (existingBadges ?? []).map(
        (b: any) => `${b.user_id}:${b.badge_definition_id}:${b.period_label ?? ""}`,
      ),
    );

    const newBadges: any[] = [];

    for (const score of officerScores) {
      for (const badge of badgeDefs ?? []) {
        let earned = false;
        const threshold = parseFloat(badge.criteria_threshold);

        switch (badge.criteria_type) {
          case "closed_count":
            earned = score.closed_count >= threshold;
            break;
          case "pipeline_volume":
            earned = score.pipeline_volume >= threshold;
            break;
          case "on_time_rate":
            earned = score.on_time_rate >= threshold && score.closed_count > 0;
            break;
          case "conditions_speed":
            earned =
              score.conditions_speed_avg_days > 0 &&
              score.conditions_speed_avg_days <= threshold;
            break;
          case "composite_score":
            earned = score.composite_score >= threshold;
            break;
        }

        if (earned) {
          const key = `${score.user_id}:${badge.id}:${periodLabel}`;
          if (!existingSet.has(key)) {
            newBadges.push({
              user_id: score.user_id,
              badge_definition_id: badge.id,
              period_label: periodLabel,
              metadata: {
                period_type: periodType,
                composite_score: score.composite_score,
              },
            });
            existingSet.add(key);
          }
        }
      }
    }

    if (newBadges.length > 0) {
      const { error: badgeErr } = await service
        .from("officer_badges")
        .insert(newBadges);
      if (badgeErr) {
        console.error("Badge insert error:", badgeErr);
      }
    }

    return jsonResp({
      period_type: periodType,
      period_label: periodLabel,
      officers_scored: officerScores.length,
      badges_awarded: newBadges.length,
      scores: officerScores.map((s) => ({
        ...s,
        rank: (s as any).rank,
        prev_rank: prevRankMap.get(s.user_id) ?? null,
      })),
    });
  } catch (e) {
    console.error(e);
    return jsonResp({ error: "Internal error" }, 500);
  }
});
