/**
 * manager-insight-agent
 * Natural-language manager Q&A over pipeline/inactivity/workload snapshots.
 * JWT required. Body: { question: string, snapshot: {...} }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getUserPersonalizationPrompt(
  supabaseUrl: string,
  serviceRoleKey: string,
  agentId: string,
  userId: string,
): Promise<string> {
  try {
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await sb
      .from("user_agent_personalizations")
      .select("additional_prompt")
      .eq("agent_id", agentId)
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.additional_prompt as string | null) ?? "";
  } catch {
    return "";
  }
}

const AGENT_SLUG = "manager-insight-agent";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      question?: string;
      snapshot?: Record<string, unknown>;
    };
    const question = String(body.question ?? "").trim();
    if (!question) {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(supabaseUrl, serviceRoleKey);

    const { data: agent, error: agentError } = await service
      .from("ai_agents")
      .select("id, system_prompt, is_enabled, provider_config")
      .eq("slug", AGENT_SLUG)
      .maybeSingle();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Manager Insight Agent not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!agent.is_enabled) {
      return new Response(JSON.stringify({ error: "Manager Insight Agent is disabled." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: openaiSetting } = await service
      .from("integration_settings")
      .select("api_key, is_active")
      .eq("provider_name", "openai")
      .maybeSingle();
    const apiKey = openaiSetting?.api_key || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || "gpt-4o-mini";
    const temperature = typeof providerConfig.temperature === "number" ? providerConfig.temperature : 0.2;
    const personalizationPrompt = await getUserPersonalizationPrompt(supabaseUrl, serviceRoleKey, agent.id, user.id);
    const effectiveSystemPrompt = personalizationPrompt
      ? `${agent.system_prompt}\n\n${personalizationPrompt}`
      : agent.system_prompt;

    const prompt = `Manager question:\n${question}\n\nSnapshot JSON:\n${JSON.stringify(body.snapshot ?? {}, null, 2)}\n\nAnswer in concise operational language. If useful, include: risks, who owns follow-up, and next action in the next 24 hours.`;
    const t0 = Date.now();

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 900,
        messages: [
          { role: "system", content: effectiveSystemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      await service.from("ai_agent_runs").insert({
        agent_id: agent.id,
        user_id: user.id,
        input: question.slice(0, 1000),
        output: null,
        status: "failed",
        error_message: errText.slice(0, 2000),
        model_used: model,
        latency_ms: Date.now() - t0,
      });
      return new Response(JSON.stringify({ error: "AI generation failed", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const answer = String(aiResult.choices?.[0]?.message?.content ?? "").trim();
    if (!answer) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await service.from("ai_agent_runs").insert({
      agent_id: agent.id,
      user_id: user.id,
      input: question.slice(0, 2000),
      output: answer.slice(0, 10000),
      status: "completed",
      model_used: model,
      latency_ms: Date.now() - t0,
    });

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manager-insight-agent error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
