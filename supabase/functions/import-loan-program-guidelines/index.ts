/**
 * Bulk update loan_programs.guidelines (JSON). Admin-only.
 * Body: { dry_run?: boolean, updates: { program_id: string, guidelines: object }[] }
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return jsonResponse({ error: "Forbidden: admin required" }, 403);
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const updates = body?.updates as
      | Array<{ program_id: string; guidelines: Record<string, unknown> }>
      | undefined;
    const dryRun = !!body?.dry_run;

    if (!Array.isArray(updates) || updates.length === 0) {
      return jsonResponse({ error: "updates array required" }, 400);
    }

    const results: Array<{ program_id: string; ok: boolean; error?: string }> = [];

    for (const u of updates) {
      if (!u.program_id || typeof u.guidelines !== "object") {
        results.push({ program_id: u?.program_id ?? "", ok: false, error: "invalid row" });
        continue;
      }

      if (dryRun) {
        results.push({ program_id: u.program_id, ok: true });
        continue;
      }

      const { error } = await supabase
        .from("loan_programs")
        .update({ guidelines: u.guidelines, updated_at: new Date().toISOString() })
        .eq("id", u.program_id);

      results.push({
        program_id: u.program_id,
        ok: !error,
        error: error?.message,
      });
    }

    return jsonResponse({
      dry_run: dryRun,
      processed: results.length,
      results,
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
