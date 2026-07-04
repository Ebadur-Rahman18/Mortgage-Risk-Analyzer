/**
 * mortgage-chat — Per-loan Mortgage Risk Copilot contextual chat.
 * Persists messages to loan_risk_chat_messages; uses Gemini via routedChatCompletion.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResp,
  routedChatCompletion,
  type ChatMessage,
} from "../_shared/ai-utils.ts";
import { assertLoanOfficerAccess, createServiceClient } from "../_shared/loan-access.ts";

const AGENT_SLUG = "mortgage-chat";
const MAX_HISTORY = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const started = Date.now();
  let stage = "init";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return jsonResp({ error: "Missing Supabase configuration" }, 500);
    }

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

    stage = "parse_body";
    const body = (await req.json().catch(() => ({}))) as { loan_id?: string; message?: string };
    if (!body.loan_id || !body.message?.trim()) {
      return jsonResp({ error: "loan_id and message are required" }, 400);
    }
    const loan_id = body.loan_id;
    const userMessage = body.message.trim();

    const service = createServiceClient();

    stage = "access";
    const access = await assertLoanOfficerAccess(userClient, service, uid, loan_id);
    if (!access.ok) {
      return jsonResp({ error: access.message }, access.status);
    }

    stage = "load_context";
    const { data: loan, error: loanErr } = await service
      .from("loans")
      .select(`
        *,
        borrowers(first_name, last_name, email, phone)
      `)
      .eq("id", loan_id)
      .maybeSingle();

    if (loanErr || !loan) {
      return jsonResp({ error: "Loan not found" }, 404);
    }

    const { data: latestAnalysis } = await service
      .from("loan_risk_analyses")
      .select("*")
      .eq("loan_id", loan_id)
      .eq("is_outdated", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: documents } = await service
      .from("loan_documents")
      .select("file_name, document_types(name)")
      .eq("loan_id", loan_id);

    const { data: history } = await service
      .from("loan_risk_chat_messages")
      .select("role, content")
      .eq("loan_id", loan_id)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY);

    const borrower = loan.borrowers as {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
    } | null;

    const contextBlock = [
      "=== LOAN CONTEXT ===",
      `Loan #: ${loan.loan_number}`,
      `Status: ${loan.status}`,
      `Borrower: ${borrower ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") : "N/A"}`,
      `Loan Amount: ${loan.loan_amount ?? "N/A"}`,
      `Property Value: ${loan.appraised_value ?? "N/A"}`,
      `Credit Score: ${loan.credit_score ?? "N/A"}`,
      `DTI: ${loan.dti ?? "N/A"}%`,
      `LTV: ${loan.ltv ?? "N/A"}%`,
      `Annual Income: ${loan.annual_income ?? "N/A"}`,
      `Monthly Debt: ${loan.monthly_debt ?? "N/A"}`,
    ];

    if (latestAnalysis) {
      contextBlock.push(
        "",
        "=== LATEST RISK ANALYSIS ===",
        `Risk Score: ${latestAnalysis.risk_score}/100 (${latestAnalysis.risk_level})`,
        `Summary: ${latestAnalysis.summary}`,
      );
    }

    if (documents && documents.length > 0) {
      contextBlock.push("", "=== UPLOADED DOCUMENTS ===");
      for (const d of documents) {
        const types = d.document_types as { name?: string } | null;
        contextBlock.push(`- ${types?.name ?? "Document"}: ${d.file_name}`);
      }
    }

    const systemPrompt = `You are a mortgage risk copilot assistant. Answer questions about this specific mortgage application using the loan context, risk analysis, and documents provided. Be concise, accurate, and actionable. If information is missing, say so clearly.

${contextBlock.join("\n")}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of history ?? []) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
    messages.push({ role: "user", content: userMessage });

    stage = "ai_call";
    const aiResult = await routedChatCompletion(messages, {
      provider: "google",
      model: "gemini-2.5-flash",
      temperature: 0.4,
      max_tokens: 2048,
    });

    const assistantText = aiResult.output.trim() || "I could not generate a response. Please try again.";
    const latency_ms = Date.now() - started;

    stage = "persist";
    const { error: userInsertErr } = await service.from("loan_risk_chat_messages").insert({
      loan_id,
      role: "user",
      content: userMessage,
      created_by: uid,
    });
    if (userInsertErr) {
      return jsonResp({ error: userInsertErr.message }, 500);
    }

    const { data: assistantRow, error: asstInsertErr } = await service
      .from("loan_risk_chat_messages")
      .insert({
        loan_id,
        role: "assistant",
        content: assistantText,
        created_by: null,
      })
      .select()
      .single();

    if (asstInsertErr) {
      return jsonResp({ error: asstInsertErr.message }, 500);
    }

    return jsonResp({
      message: assistantText,
      id: assistantRow.id,
      created_at: assistantRow.created_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    console.error(`[${AGENT_SLUG}] ${stage}:`, message);
    return jsonResp({ error: message, stage }, 500);
  }
});
