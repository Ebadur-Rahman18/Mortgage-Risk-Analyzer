/**
 * condition-workflow-engine — Auto-assigns party, sets due date, and sends
 * notifications when a loan condition is created.
 *
 * Called fire-and-forget from the frontend after condition insert.
 * Self-contained — no _shared/ imports for portability.
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

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const body = (await req.json().catch(() => ({}))) as {
      condition_id: string;
      loan_id: string;
    };

    const { condition_id, loan_id } = body;
    if (!condition_id || !loan_id) {
      return jsonResp({ error: "condition_id and loan_id are required" }, 400);
    }

    const service = createClient(supabaseUrl, serviceKey);

    // Load condition
    const { data: condition, error: condErr } = await service
      .from("loan_conditions")
      .select("*")
      .eq("id", condition_id)
      .eq("loan_id", loan_id)
      .maybeSingle();

    if (condErr || !condition) {
      return jsonResp({ error: "Condition not found" }, 404);
    }

    // Already processed (has assigned_party set)
    if (condition.assigned_party) {
      return jsonResp({ message: "Already processed", condition_id });
    }

    // Load loan with borrower info
    const { data: loan } = await service
      .from("loans")
      .select("id, loan_number, loan_officer_id, borrower_id, branch_id, borrowers(id, first_name, last_name, email)")
      .eq("id", loan_id)
      .maybeSingle();

    if (!loan) {
      return jsonResp({ error: "Loan not found" }, 404);
    }

    // Load workflow rules
    const { data: rules } = await service
      .from("condition_workflow_rules")
      .select("*")
      .eq("condition_type", condition.condition_type)
      .eq("is_enabled", true);

    // Match rule by category keyword (case-insensitive partial match)
    const condCategory = (condition.category || "").toLowerCase().trim();
    const condDescription = (condition.description || "").toLowerCase();
    let matchedRule: any = null;

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        const keyword = (rule.category_keyword || "").toLowerCase();
        if (
          condCategory.includes(keyword) ||
          keyword.includes(condCategory) ||
          condDescription.includes(keyword)
        ) {
          matchedRule = rule;
          break;
        }
      }
    }

    // Determine assignment
    let assignedParty = matchedRule?.assigned_party || "internal";
    let assignedToUserId: string | null = null;
    const dueDays = matchedRule?.auto_due_days ?? 5;
    const priority = matchedRule?.priority || "normal";

    // Resolve assigned_to_user_id based on party
    if (assignedParty === "loan_officer" && loan.loan_officer_id) {
      assignedToUserId = loan.loan_officer_id;
    }

    // Calculate due date if not already set
    let dueDate = condition.due_date;
    if (!dueDate) {
      const fromDate = new Date(condition.created_at);
      const calcDate = addBusinessDays(fromDate, dueDays);
      dueDate = calcDate.toISOString().split("T")[0];
    }

    // Update condition
    const updatePayload: Record<string, unknown> = {
      assigned_party: assignedParty,
      priority,
      due_date: dueDate,
    };
    if (assignedToUserId) {
      updatePayload.assigned_to_user_id = assignedToUserId;
    }

    const { error: updateErr } = await service
      .from("loan_conditions")
      .update(updatePayload)
      .eq("id", condition_id);

    if (updateErr) {
      console.error("Condition update error:", updateErr);
      return jsonResp({ error: "Failed to update condition" }, 500);
    }

    // ── Notifications ─────────────────────────────────────────────────

    const borrower = (loan as any).borrowers;
    const borrowerName = borrower
      ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "Borrower"
      : "Borrower";
    const borrowerEmail = borrower?.email;
    const condDesc = condition.description?.slice(0, 80) || "condition";

    // Notify assigned staff user (in-app)
    if (assignedToUserId) {
      await service
        .from("notifications")
        .insert({
          user_id: assignedToUserId,
          title: "New condition assigned to you",
          message: `${condition.condition_type}: ${condDesc} — Loan ${loan.loan_number || loan_id.slice(0, 8)}`,
          type: "info",
          link: `/loans/${loan_id}`,
          metadata: {
            event_type: "condition_assigned",
            condition_id,
            loan_id,
            assigned_party: assignedParty,
          },
          dedupe_key: `cond_assign:${condition_id}`,
          is_read: false,
        })
        .then(() => {})
        .catch((e: unknown) => console.error("Notification error:", e));
    }

    // Notify loan officer if someone else is assigned
    if (
      assignedParty !== "loan_officer" &&
      loan.loan_officer_id &&
      loan.loan_officer_id !== assignedToUserId
    ) {
      await service
        .from("notifications")
        .insert({
          user_id: loan.loan_officer_id,
          title: `Condition auto-assigned to ${assignedParty}`,
          message: `${condition.condition_type}: ${condDesc} — Due ${dueDate}`,
          type: "info",
          link: `/loans/${loan_id}`,
          metadata: {
            event_type: "condition_workflow",
            condition_id,
            loan_id,
            assigned_party: assignedParty,
          },
          dedupe_key: `cond_wf_lo:${condition_id}`,
          is_read: false,
        })
        .then(() => {})
        .catch((e: unknown) => console.error("LO notification error:", e));
    }

    // If assigned to borrower and borrower has email, send email notification
    if (assignedParty === "borrower" && borrowerEmail) {
      // Resolve SendGrid credentials
      const { data: sgSetting } = await service
        .from("integration_settings")
        .select("api_key, metadata")
        .eq("provider_name", "sendgrid")
        .eq("is_active", true)
        .maybeSingle();

      const sgApiKey = sgSetting?.api_key || Deno.env.get("SENDGRID_API_KEY");
      const sgMeta = (sgSetting?.metadata || {}) as Record<string, unknown>;
      const fromEmail = (sgMeta.from_email as string) || "noreply@example.com";
      const fromName = (sgMeta.from_name as string) || "Loan Team";

      if (sgApiKey) {
        const portalUrl = Deno.env.get("BORROWER_PORTAL_APP_URL") || "https://app.example.com/portal";

        const emailBody = [
          `Hi ${borrowerName},`,
          "",
          `Your lender needs the following for Loan ${loan.loan_number || ""}:`,
          "",
          `  ${condition.condition_type}: ${condition.description}`,
          dueDate ? `  Due by: ${dueDate}` : "",
          "",
          `You can upload documents directly through your portal:`,
          portalUrl,
          "",
          "Thank you,",
          fromName,
        ]
          .filter((line) => line !== undefined)
          .join("\n");

        try {
          await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sgApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: borrowerEmail }] }],
              from: { email: fromEmail, name: fromName },
              subject: `Action needed: ${condition.condition_type} condition for your loan`,
              content: [{ type: "text/plain", value: emailBody }],
            }),
          });
        } catch (e) {
          console.error("SendGrid email error:", e);
        }
      }
    }

    return jsonResp({
      message: "Workflow applied",
      condition_id,
      assigned_party: assignedParty,
      assigned_to_user_id: assignedToUserId,
      due_date: dueDate,
      priority,
      rule_matched: matchedRule?.category_keyword || null,
    });
  } catch (err) {
    console.error(err);
    return jsonResp({ error: "Internal server error" }, 500);
  }
});
