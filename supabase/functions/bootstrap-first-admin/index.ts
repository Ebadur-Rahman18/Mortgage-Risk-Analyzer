// Bootstrap the very first admin account.
// - GET  → { open: boolean }  (true when no admin exists yet)
// - POST → creates the first admin user; subsequent calls return 403.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function adminCount(admin: ReturnType<typeof createClient>) {
  const { count, error } = await admin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw error;
  return count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (req.method === "GET") {
      const c = await adminCount(admin);
      return json({ open: c === 0 });
    }

    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = String(body.full_name ?? "").trim();

    if (!email || !password || password.length < 6) {
      return json({ error: "invalid_input" }, 400);
    }

    // Race-safe re-check.
    if ((await adminCount(admin)) > 0) {
      return json({ error: "signup_closed" }, 403);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "create_failed" }, 400);
    }

    const uid = created.user.id;

    // Ensure profile (trigger may have done it already).
    await admin
      .from("profiles")
      .upsert({ id: uid, email, full_name }, { onConflict: "id" });

    // Remove the default 'user' role the trigger inserted, then add admin.
    await admin.from("user_roles").delete().eq("user_id", uid);
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: uid, role: "admin" });
    if (roleErr) {
      return json({ error: roleErr.message }, 500);
    }

    return json({ ok: true, user_id: uid });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
