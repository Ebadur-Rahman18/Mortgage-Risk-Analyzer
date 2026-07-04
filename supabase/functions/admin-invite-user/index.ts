// Admin creates a new user directly (auto-confirmed) and emails credentials.
// Caller must be authenticated as an admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "admin" | "moderator" | "user" | "loan_officer";
const ALLOWED_ROLES: AppRole[] = ["admin", "moderator", "user", "loan_officer"];

function genTempPassword(): string {
  // 16 chars: upper/lower/digit/symbol guaranteed.
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const sym = "!@#$%^&*";
  const all = upper + lower + digit + sym;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digit) + pick(sym);
  for (let i = 0; i < 12; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

function inviteEmailHtml(opts: { full_name: string; email: string; password: string; role: string; loginUrl: string; appName: string }) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h1 style="margin:0 0 16px;font-size:22px;color:#0f3d3a">Welcome to ${opts.appName}</h1>
    <p>Hi ${opts.full_name || "there"},</p>
    <p>An administrator created an account for you on <strong>${opts.appName}</strong> with the role <strong>${opts.role}</strong>.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0 0 8px"><strong>Email:</strong> ${opts.email}</p>
      <p style="margin:0"><strong>Temporary password:</strong> <code style="background:#fff;padding:4px 8px;border-radius:4px;border:1px solid #d1d5db">${opts.password}</code></p>
    </div>
    <p>Please sign in and change your password right away.</p>
    <p><a href="${opts.loginUrl}" style="display:inline-block;background:#0f3d3a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a></p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">If you didn't expect this email, you can ignore it.</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller } } = await authClient.auth.getUser();
  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerRole } = await admin
    .from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
  if (callerRole?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const email = String(body?.email ?? "").trim().toLowerCase();
  const full_name = String(body?.full_name ?? "").trim();
  const role = String(body?.role ?? "user") as AppRole;

  if (!email || !/.+@.+\..+/.test(email)) {
    return new Response(JSON.stringify({ error: "Valid email required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check if user already exists
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((x) => x.email?.toLowerCase() === email);
  if (existing) {
    return new Response(JSON.stringify({
      error: `A user with ${email} already exists. Please use a different email.`,
      code: "user_exists",
      email,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const password = genTempPassword();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || email.split("@")[0] },
  });
  if (cErr || !created?.user) {
    return new Response(JSON.stringify({ error: cErr?.message || "Failed to create user" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const newUserId = created.user.id;

  await admin.from("profiles").upsert(
    { id: newUserId, email, full_name: full_name || null },
    { onConflict: "id" },
  );
  await admin.from("user_roles").delete().eq("user_id", newUserId);
  await admin.from("user_roles").insert({ user_id: newUserId, role });

  // Audit row
  await admin.from("user_invites").insert({
    email, role, invited_by: caller.id, used_at: new Date().toISOString(),
  });

  // Try to send email — non-fatal if infra not set up
  const appName = "Mortgage Control Tower";
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const loginUrl = origin ? `${origin.replace(/\/$/, "")}/login` : "https://mct-lite.lovable.app/login";
  const html = inviteEmailHtml({ full_name: full_name || email, email, password, role, loginUrl, appName });

  let emailStatus: "sent" | "skipped" | "failed" = "skipped";
  let emailError: string | null = null;
  try {
    const sendRes = await admin.functions.invoke("send-transactional-email", {
      body: {
        to: email,
        subject: `You've been invited to ${appName}`,
        html,
      },
    });
    if (sendRes.error) {
      emailStatus = "failed";
      emailError = String(sendRes.error?.message || sendRes.error);
    } else {
      emailStatus = "sent";
    }
  } catch (err) {
    emailStatus = "failed";
    emailError = String(err);
  }

  // Activity log (best-effort)
  try {
    await admin.rpc("log_activity", {
      p_action: "user.invited",
      p_resource_type: "user",
      p_resource_id: newUserId,
      p_details: { email, role, email_status: emailStatus },
    });
  } catch { /* ignore */ }

  return new Response(JSON.stringify({
    ok: true,
    user_id: newUserId,
    email,
    role,
    temp_password: password,
    email_status: emailStatus,
    email_error: emailError,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
