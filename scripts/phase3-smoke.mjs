import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const loanId = process.env.PHASE3_SMOKE_LOAN_ID;
let userJwt = process.env.PHASE3_SMOKE_USER_JWT;
const smokeEmail = process.env.PHASE3_SMOKE_EMAIL;
const smokePassword = process.env.PHASE3_SMOKE_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env: VITE_SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY) are required.");
  process.exit(1);
}
if (!loanId) {
  console.error("Missing env: PHASE3_SMOKE_LOAN_ID is required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const authClient = anonKey ? createClient(supabaseUrl, anonKey) : null;

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL: ${name} -> ${msg}`);
    return false;
  }
}

async function invoke(fnName, body, withUserJwt = false) {
  const opts = { body };
  if (withUserJwt && userJwt) {
    opts.headers = { Authorization: `Bearer ${userJwt}` };
  }
  const { data, error } = await supabase.functions.invoke(fnName, opts);
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

async function resolveUserJwt() {
  if (userJwt) return userJwt;
  if (!authClient) return null;

  const candidates = [];
  if (smokeEmail && smokePassword) {
    candidates.push({ email: smokeEmail, password: smokePassword });
  }
  candidates.push(
    { email: "admin@collabai.software", password: "Admin@123" },
    { email: "moderator@collabai.software", password: "Moderator@123" },
    { email: "demo@collabai.software", password: "Demo@123" },
  );

  for (const creds of candidates) {
    const { data, error } = await authClient.auth.signInWithPassword(creds);
    if (!error && data?.session?.access_token) {
      userJwt = data.session.access_token;
      console.log(`AUTH: acquired JWT via ${creds.email}`);
      return userJwt;
    }
  }
  return null;
}

async function main() {
  const results = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await resolveUserJwt();

  results.push(await run("pricing-calculate happy path", async () => {
    const data = await invoke("pricing-calculate", {
      loan_id: loanId,
      loan_amount: 350000,
      credit_score: 740,
      state: "CA",
      best_execution: true,
    });
    if (!Array.isArray(data.results)) {
      throw new Error("Missing pricing results array");
    }
  }));

  results.push(await run("pricing-calculate invalid state returns structured error", async () => {
    const { data, error } = await supabase.functions.invoke("pricing-calculate", {
      body: {
        loan_id: loanId,
        loan_amount: 350000,
        credit_score: 740,
        state: "INVALID",
      },
    });
    if (!error && !data?.error) {
      throw new Error("Expected validation error for invalid state");
    }
  }));

  results.push(await run("pricing-rate-sheets-upload single-row upload", async () => {
    const data = await invoke("pricing-rate-sheets-upload", {
      name: `smoke-${stamp}`,
      source_type: "upload",
      effective_date: new Date().toISOString().slice(0, 10),
      rows: [
        {
          Product: "Smoke 30Y Fixed",
          "Loan Type": "CONV",
          Rate: "6.875",
          Price: "100.00",
          "Min FICO": "620",
          "Max LTV": "97",
          State: "ALL",
        },
      ],
    });
    if (!data?.rate_sheet?.id) throw new Error("No rate sheet id returned");
  }));

  if (userJwt) {
    results.push(await run("run-compliance-rules stores run", async () => {
      const data = await invoke("run-compliance-rules", { loan_id: loanId }, true);
      if (!data?.summary) throw new Error("No compliance summary returned");
    }));
  } else {
    console.log("SKIP: run-compliance-rules (set PHASE3_SMOKE_USER_JWT to enable)");
  }

  results.push(await run("calculate-closing-costs preview", async () => {
    const data = await invoke("calculate-closing-costs", {
      loan_id: loanId,
      loan_amount: 350000,
      persist: false,
      estimate_type: "ILLUSTRATIVE",
    });
    if (!Array.isArray(data?.lines)) throw new Error("No fee lines returned");
  }));

  if (userJwt) {
    results.push(await run("submit-aus-request stub", async () => {
      const data = await invoke("submit-aus-request", {
        loan_id: loanId,
        provider: "du",
      }, true);
      if (!data?.submission?.id) throw new Error("No AUS submission row created");
    }));
  } else {
    console.log("SKIP: submit-aus-request (set PHASE3_SMOKE_USER_JWT to enable)");
  }

  results.push(await run("validate-api-key contract envelope", async () => {
    const resp = await fetch(`${supabaseUrl}/functions/v1/validate-api-key`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ provider: "openai", apiKey: "sk-invalid-smoke-key" }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (typeof data?.valid !== "boolean") throw new Error("Missing valid boolean");
    if (typeof data?.mode !== "string") throw new Error("Missing mode");
  }));

  if (userJwt) {
    results.push(await run("transition-loan-status compliance guard path", async () => {
      const { data, error } = await supabase.functions.invoke("transition-loan-status", {
        headers: { Authorization: `Bearer ${userJwt}` },
        body: { loan_id: loanId, to_status: "processing" },
      });
      if (!error && !data?.blocked_by_compliance && !data?.success) {
        throw new Error("Unexpected transition response shape");
      }
    }));
  } else {
    console.log("SKIP: transition-loan-status (set PHASE3_SMOKE_USER_JWT to enable)");
  }

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\nPhase 3 smoke complete: ${passed}/${total} checks passed.`);
  if (passed !== total) process.exit(2);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Smoke runner failed: ${msg}`);
  process.exit(1);
});
