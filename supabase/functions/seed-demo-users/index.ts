// Seeds the 3 demo accounts + a sample pipeline (borrowers, loans, tasks). Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DemoUser {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "moderator" | "user" | "loan_officer";
}

const DEMO_USERS: DemoUser[] = [
  { email: "admin@demo.co", password: "DemoAdmin!2026", full_name: "Demo Admin", role: "admin" },
  { email: "lo@demo.co",    password: "DemoLO!2026",    full_name: "Demo Loan Officer", role: "loan_officer" },
  { email: "user@demo.co",  password: "DemoU!2026",     full_name: "Demo User", role: "user" },
];

const DEMO_BORROWERS = [
  { ext: "demo-b-001", first_name: "Sarah",   last_name: "Mitchell", email: "sarah.mitchell@example.com",  phone: "555-0101", city: "Austin",      state: "TX", postal_code: "78701" },
  { ext: "demo-b-002", first_name: "James",   last_name: "Carter",   email: "james.carter@example.com",    phone: "555-0102", city: "Denver",      state: "CO", postal_code: "80202" },
  { ext: "demo-b-003", first_name: "Priya",   last_name: "Patel",    email: "priya.patel@example.com",     phone: "555-0103", city: "Seattle",     state: "WA", postal_code: "98101" },
  { ext: "demo-b-004", first_name: "Marcus",  last_name: "Johnson",  email: "marcus.johnson@example.com",  phone: "555-0104", city: "Charlotte",   state: "NC", postal_code: "28202" },
  { ext: "demo-b-005", first_name: "Elena",   last_name: "Rodriguez",email: "elena.rodriguez@example.com", phone: "555-0105", city: "Phoenix",     state: "AZ", postal_code: "85004" },
];

const DEMO_LOANS = [
  { ext: "demo-l-001", borrower_ext: "demo-b-001", loan_number: "MCT-1001", loan_amount: 425000, interest_rate: 6.625, loan_type: "Conventional", loan_purpose: "Purchase",   purpose: "Purchase",   status: "application",  stage: "application",  ltv: 80,  credit_score: 745, dti: 36.5, property_city: "Austin",    property_state: "TX", property_zip: "78701" },
  { ext: "demo-l-002", borrower_ext: "demo-b-002", loan_number: "MCT-1002", loan_amount: 312000, interest_rate: 6.500, loan_type: "FHA",          loan_purpose: "Purchase",   purpose: "Purchase",   status: "processing",   stage: "processing",   ltv: 96.5,credit_score: 680, dti: 42.0, property_city: "Denver",    property_state: "CO", property_zip: "80202" },
  { ext: "demo-l-003", borrower_ext: "demo-b-003", loan_number: "MCT-1003", loan_amount: 615000, interest_rate: 6.750, loan_type: "Conventional", loan_purpose: "Refinance",  purpose: "Refinance",  status: "underwriting", stage: "underwriting", ltv: 70,  credit_score: 790, dti: 33.0, property_city: "Seattle",   property_state: "WA", property_zip: "98101" },
  { ext: "demo-l-004", borrower_ext: "demo-b-004", loan_number: "MCT-1004", loan_amount: 285000, interest_rate: 6.375, loan_type: "VA",           loan_purpose: "Purchase",   purpose: "Purchase",   status: "approved",     stage: "approved",     ltv: 100, credit_score: 720, dti: 38.5, property_city: "Charlotte", property_state: "NC", property_zip: "28202" },
  { ext: "demo-l-005", borrower_ext: "demo-b-005", loan_number: "MCT-1005", loan_amount: 395000, interest_rate: 6.500, loan_type: "Conventional", loan_purpose: "Purchase",   purpose: "Purchase",   status: "closing",      stage: "closing",      ltv: 78,  credit_score: 755, dti: 35.0, property_city: "Phoenix",   property_state: "AZ", property_zip: "85004" },
  { ext: "demo-l-006", borrower_ext: "demo-b-001", loan_number: "MCT-1006", loan_amount: 510000, interest_rate: 6.250, loan_type: "Jumbo",        loan_purpose: "Refinance",  purpose: "Refinance",  status: "funded",       stage: "funded",       ltv: 65,  credit_score: 810, dti: 30.0, property_city: "Austin",    property_state: "TX", property_zip: "78704" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: any[] = [];
  const userIds: Record<string, string> = {};

  // 1. Demo users
  for (const u of DEMO_USERS) {
    try {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users.find((x) => x.email?.toLowerCase() === u.email);

      let userId: string;
      if (existing) {
        userId = existing.id;
        await admin.auth.admin.updateUserById(userId, {
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
      } else {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (cErr) throw cErr;
        userId = created.user!.id;
      }

      await admin.from("profiles").upsert(
        { id: userId, email: u.email, full_name: u.full_name },
        { onConflict: "id" },
      );

      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: u.role });

      userIds[u.email] = userId;
      results.push({ email: u.email, userId, role: u.role, ok: true });
    } catch (err) {
      results.push({ email: u.email, ok: false, error: String(err) });
    }
  }

  const adminId = userIds["admin@demo.co"];
  const loId = userIds["lo@demo.co"];
  const userId = userIds["user@demo.co"];

  // 2. Seed pipeline only if LO exists
  const seed: any = { borrowers: 0, loans: 0, tasks: 0 };
  if (loId) {
    try {
      // Clean previous demo rows (cascade-friendly: tasks → loans → borrowers)
      await admin.from("tasks").delete().like("title", "[demo]%");
      await admin.from("loans").delete().eq("data_source", "demo");
      await admin.from("borrowers").delete().eq("data_source", "demo");

      // Borrowers
      const borrowerRows = DEMO_BORROWERS.map((b) => ({
        first_name: b.first_name,
        last_name: b.last_name,
        email: b.email,
        phone: b.phone,
        city: b.city,
        state: b.state,
        postal_code: b.postal_code,
        zip_code: b.postal_code,
        created_by: loId,
        data_source: "demo",
        external_id: b.ext,
      }));
      const { data: insertedBorrowers, error: bErr } = await admin
        .from("borrowers").insert(borrowerRows).select("id, external_id");
      if (bErr) throw bErr;
      seed.borrowers = insertedBorrowers?.length ?? 0;
      const borrowerByExt = new Map((insertedBorrowers ?? []).map((b: any) => [b.external_id, b.id]));

      // Loans
      const loanRows = DEMO_LOANS.map((l) => ({
        loan_number: l.loan_number,
        loan_amount: l.loan_amount,
        interest_rate: l.interest_rate,
        loan_type: l.loan_type,
        loan_purpose: l.loan_purpose,
        purpose: l.purpose,
        status: l.status,
        stage: l.stage,
        ltv: l.ltv,
        credit_score: l.credit_score,
        dti: l.dti,
        property_city: l.property_city,
        property_state: l.property_state,
        property_zip: l.property_zip,
        borrower_id: borrowerByExt.get(l.borrower_ext) ?? null,
        loan_officer_id: loId,
        created_by: loId,
        data_source: "demo",
        external_id: l.ext,
      }));
      const { data: insertedLoans, error: lErr } = await admin
        .from("loans").insert(loanRows).select("id, external_id");
      if (lErr) throw lErr;
      seed.loans = insertedLoans?.length ?? 0;
      const firstLoanId = insertedLoans?.[0]?.id ?? null;

      // Tasks: visible across all 3 roles via assignment
      const now = new Date();
      const due = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();
      const taskRows: any[] = [];
      if (adminId && loId) {
        taskRows.push(
          { title: "[demo] Review borrower income docs", description: "Pay stubs + W-2 for Sarah Mitchell", status: "open", priority: "high",   created_by: adminId, assigned_to: loId, loan_id: firstLoanId, due_date: due(2) },
          { title: "[demo] Confirm appraisal order",     description: "Schedule appraisal for MCT-1003",    status: "open", priority: "medium", created_by: adminId, assigned_to: loId, loan_id: null,        due_date: due(5) },
        );
      }
      if (loId && userId) {
        taskRows.push(
          { title: "[demo] Upload signed disclosures",   description: "Borrower returned LE — file in loan folder", status: "open", priority: "medium", created_by: loId, assigned_to: userId, loan_id: firstLoanId, due_date: due(3) },
          { title: "[demo] Verify employment letter",    description: "Call HR contact for Marcus Johnson",         status: "open", priority: "low",    created_by: loId, assigned_to: userId, loan_id: null,        due_date: due(7) },
        );
      }
      if (adminId) {
        taskRows.push(
          { title: "[demo] Approve new loan officer onboarding", description: "Review profile + role assignment", status: "open", priority: "low", created_by: adminId, assigned_to: adminId, loan_id: null, due_date: due(10) },
        );
      }
      if (taskRows.length > 0) {
        const { data: insertedTasks, error: tErr } = await admin.from("tasks").insert(taskRows).select("id");
        if (tErr) throw tErr;
        seed.tasks = insertedTasks?.length ?? 0;
      }
    } catch (err) {
      seed.error = String(err);
    }
  }

  return new Response(JSON.stringify({ results, seed }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
