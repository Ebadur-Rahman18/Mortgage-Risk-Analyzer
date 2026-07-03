import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RoleScope = "org" | "branch" | "none";
type TaskType = "stale_loan_reminder" | "stale_loan_escalation";

interface ProfileRow {
  id: string;
  role: string | null;
  branch_id: string | null;
  full_name: string | null;
  email: string | null;
}

interface UserRoleRow {
  role: string | null;
  custom_role_id: string | null;
}

interface LoanRow {
  id: string;
  loan_number: string | null;
  status: string | null;
  updated_at: string | null;
  created_at: string;
  loan_officer_id: string | null;
  branch_id: string | null;
}

interface LoanCandidate extends LoanRow {
  untouchedDays: number;
}

interface OfficerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface ExistingActionItem {
  id: string;
  loan_id: string | null;
  assigned_to_user_id: string | null;
  task_type: string | null;
  status: string;
}

function normalizeRole(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isTerminalStatus(status: string | null | undefined): boolean {
  const s = normalizeRole(status);
  return s === "closed" || s === "denied" || s === "withdrawn";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const service = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      service.from("profiles").select("id, role, branch_id, full_name, email").eq("id", userId).maybeSingle(),
      service.from("user_roles").select("role, custom_role_id").eq("user_id", userId).maybeSingle(),
    ]);
    const profileRow = profile as ProfileRow | null;
    const userRoleRow = roleRow as UserRoleRow | null;

    let customRoleSlug: string | null = null;
    if (userRoleRow?.custom_role_id) {
      const { data: customRole } = await service
        .from("roles")
        .select("slug")
        .eq("id", userRoleRow.custom_role_id)
        .maybeSingle();
      customRoleSlug = (customRole as { slug?: string } | null)?.slug ?? null;
    }

    const appRole = normalizeRole(profileRow?.role ?? userRoleRow?.role);
    const customRole = normalizeRole(customRoleSlug);

    let scope: RoleScope = "none";
    if (appRole === "admin" || appRole === "moderator") {
      scope = "org";
    } else if (customRole === "branch_manager") {
      scope = "branch";
    }

    if (scope === "none") {
      return new Response(JSON.stringify({ error: "Only admin/moderator/branch manager can run reminder sweep." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const managerName = profileRow?.full_name || profileRow?.email || "Manager";
    const managerBranchId = profileRow?.branch_id ?? null;

    let loanQuery = service
      .from("loans")
      .select("id, loan_number, status, updated_at, created_at, loan_officer_id, branch_id")
      .not("loan_officer_id", "is", null);

    if (scope === "branch") {
      loanQuery = loanQuery.eq("branch_id", managerBranchId);
    }

    const { data: loans, error: loansErr } = await loanQuery;
    if (loansErr) {
      return new Response(JSON.stringify({ error: loansErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loanRows = (loans ?? []) as LoanRow[];
    const candidates: LoanCandidate[] = loanRows
      .filter((loan) => !isTerminalStatus(loan.status))
      .map((loan) => {
        const lastTouch = new Date(loan.updated_at || loan.created_at);
        const untouchedMs = now.getTime() - lastTouch.getTime();
        const untouchedDays = Math.max(0, Math.floor(untouchedMs / (24 * 60 * 60 * 1000)));
        return { ...loan, untouchedDays };
      })
      .filter((loan) => loan.untouchedDays >= 7);

    if (candidates.length === 0) {
      return new Response(JSON.stringify({
        message: "No stale loans found.",
        summary: { scanned_loans: loanRows.length, stale_loans: 0, created_action_items: 0, created_notifications: 0 },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const officerIds = [...new Set(candidates.map((loan) => loan.loan_officer_id).filter((v): v is string => !!v))];
    const { data: officerProfiles } = await service
      .from("profiles")
      .select("id, full_name, email")
      .in("id", officerIds);
    const officerMap = new Map((officerProfiles ?? [] as OfficerProfile[]).map((p) => [p.id, p]));

    const { data: existingItems } = await service
      .from("action_items")
      .select("id, loan_id, assigned_to_user_id, task_type, status")
      .eq("source", "agent")
      .in("task_type", ["stale_loan_reminder", "stale_loan_escalation"])
      .in("status", ["not_started", "in_progress", "blocked", "on_hold"]);

    const existingKey = new Set(
      ((existingItems ?? []) as ExistingActionItem[]).map(
        (it) => `${it.task_type ?? ""}|${it.loan_id ?? ""}|${it.assigned_to_user_id ?? ""}`,
      ),
    );

    const actionsToInsert: Record<string, unknown>[] = [];
    const notificationsToInsert: Record<string, unknown>[] = [];

    for (const loan of candidates) {
      if (!loan.loan_officer_id) continue;
      const loanId = loan.id;
      const loanNumber = loan.loan_number || loanId.slice(0, 8);
      const officerId = loan.loan_officer_id;
      const officer = officerMap.get(officerId);
      const officerName = officer?.full_name || officer?.email || "Loan officer";
      const untouchedDays = loan.untouchedDays;
      const isEscalation = untouchedDays >= 21;
      const taskType: TaskType = isEscalation ? "stale_loan_escalation" : "stale_loan_reminder";
      const dueDate = new Date(now.getTime() + (isEscalation ? 1 : 2) * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const officerKey = `${taskType}|${loanId}|${officerId}`;
      if (!existingKey.has(officerKey)) {
        actionsToInsert.push({
          title: isEscalation
            ? `Escalation: Loan ${loanNumber} untouched for ${untouchedDays} days`
            : `Reminder: Loan ${loanNumber} untouched for ${untouchedDays} days`,
          description: isEscalation
            ? `${managerName} escalated this file due to inactivity. Please update loan timeline today.`
            : `${managerName} requested an activity update on this loan due to inactivity.`,
          created_by_user_id: userId,
          assigned_to_user_id: officerId,
          assigned_by_user_id: userId,
          watchers: [userId, officerId],
          loan_id: loanId,
          source: "agent",
          priority: isEscalation ? "high" : "normal",
          status: "not_started",
          due_date: dueDate,
          task_type: taskType,
          metadata: {
            untouched_days: untouchedDays,
            escalation_level: isEscalation ? "manager" : "reminder",
            generated_by: "manager-inactivity-reminders",
          },
        });
        existingKey.add(officerKey);
      }

      notificationsToInsert.push({
        user_id: officerId,
        title: isEscalation ? "Loan activity escalation" : "Loan activity reminder",
        message: `Loan ${loanNumber} has been untouched for ${untouchedDays} days. Please update the file today.`,
        type: isEscalation ? "warning" : "info",
        link: `/loans/${loanId}`,
        is_read: false,
        dedupe_key: `${taskType}:${loanId}:${officerId}`,
        metadata: {
          loan_id: loanId,
          untouched_days: untouchedDays,
          generated_by: "manager-inactivity-reminders",
        },
      });

      if (isEscalation) {
        const managerKey = `${taskType}|${loanId}|${userId}`;
        if (!existingKey.has(managerKey)) {
          actionsToInsert.push({
            title: `Manager follow-up: ${officerName} has stale loan ${loanNumber}`,
            description: `Escalation triggered at ${untouchedDays} untouched days. Coordinate immediate action.`,
            created_by_user_id: userId,
            assigned_to_user_id: userId,
            assigned_by_user_id: null,
            watchers: [userId],
            loan_id: loanId,
            source: "agent",
            priority: "high",
            status: "not_started",
            due_date: dueDate,
            task_type: "stale_loan_escalation",
            metadata: {
              untouched_days: untouchedDays,
              escalated_officer_id: officerId,
              generated_by: "manager-inactivity-reminders",
            },
          });
          existingKey.add(managerKey);
        }
      }
    }

    if (actionsToInsert.length > 0) {
      const { error: insertActionsErr } = await service.from("action_items").insert(actionsToInsert);
      if (insertActionsErr) {
        return new Response(JSON.stringify({ error: insertActionsErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (notificationsToInsert.length > 0) {
      await service.from("notifications").insert(notificationsToInsert);
    }

    return new Response(JSON.stringify({
      message: "Inactivity reminder sweep completed.",
      summary: {
        scanned_loans: loanRows.length,
        stale_loans: candidates.length,
        created_action_items: actionsToInsert.length,
        created_notifications: notificationsToInsert.length,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manager-inactivity-reminders error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
