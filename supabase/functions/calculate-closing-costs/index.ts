import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LineDef {
  code: string;
  label: string;
  category: string;
  fee_type: string;
  amount_flat?: number;
  percent_of_loan?: number;
  paid_by?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const loan_amount = Number(body.loan_amount ?? 0);
    const loan_id = body.loan_id as string | undefined;
    const estimate_type = (body.estimate_type as string) || "ILLUSTRATIVE";
    const persist = !!body.persist && !!loan_id;

    if (!loan_amount || loan_amount <= 0) {
      return new Response(JSON.stringify({ error: "loan_amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: template } = await supabase
      .from("fee_template_versions")
      .select("*")
      .eq("is_active", true)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const linesRaw = (template?.lines ?? []) as LineDef[];
    const computed = linesRaw.map((line) => {
      let amount = 0;
      if (line.fee_type === "percent" && line.percent_of_loan != null) {
        amount = (loan_amount * line.percent_of_loan) / 100;
      } else {
        amount = Number(line.amount_flat ?? 0);
      }
      return {
        code: line.code,
        label: line.label,
        category: line.category,
        paid_by: line.paid_by ?? "borrower",
        amount: +amount.toFixed(2),
      };
    });

    const totalBorrower = computed
      .filter((l) => l.paid_by === "borrower")
      .reduce((s, l) => s + l.amount, 0);

    const disclaimer =
      "Illustrative estimate only — not a regulatory Loan Estimate or Closing Disclosure.";

    let saved_id: string | null = null;
    if (persist && loan_id) {
      const authHeader = req.headers.get("Authorization");
      let uid: string | null = null;
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        uid = user?.id ?? null;
      }
      const { data: ins, error: persistErr } = await supabase
        .from("loan_fee_estimates")
        .insert({
          loan_id,
          estimate_type: estimate_type === "LE" || estimate_type === "CD" ? estimate_type : "ILLUSTRATIVE",
          lines: computed,
          total_borrower: +totalBorrower.toFixed(2),
          total_seller: 0,
          disclaimer,
          created_by: uid,
        })
        .select("id")
        .single();
      if (persistErr) {
        return new Response(JSON.stringify({ error: persistErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      saved_id = ins?.id ?? null;
    }

    return new Response(
      JSON.stringify({
        template_name: template?.name ?? "inline",
        lines: computed,
        total_borrower: +totalBorrower.toFixed(2),
        total_seller: 0,
        disclaimer,
        persisted_id: saved_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
