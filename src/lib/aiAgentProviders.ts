/**
 * Single source for AI agent LLM provider + model lists (Admin AI Agents UI, Agent Chat).
 * Edge routing lives in `supabase/functions/_shared/ai-utils.ts` — keep provider slugs aligned.
 */

export type LlmProvider = "lovable" | "openai" | "google" | "anthropic" | "perplexity";

/**
 * Default to Lovable AI Gateway — it's a zero-config seed provider (LOVABLE_API_KEY
 * is auto-provisioned in Supabase Edge env) so agents work out-of-the-box.
 * Admins can switch to OpenAI/Anthropic/Google once they've configured their own key
 * in Admin → Integrations; the edge dispatcher will use that key when present and
 * automatically fall back to Lovable AI if not.
 */
export const DEFAULT_AGENT_LLM_PROVIDER: LlmProvider = "lovable";

export const LLM_PROVIDER_OPTIONS: Array<{ value: LlmProvider; label: string }> = [
  { value: "lovable", label: "Lovable AI (default — no API key needed)" },
  { value: "google", label: "Google AI (Gemini)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "perplexity", label: "Perplexity" },
];

export const AI_MODELS_BY_PROVIDER: Record<LlmProvider, Array<{ value: string; label: string }>> = {
  lovable: [
    { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash — Fast, balanced (recommended)" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash — Cost-efficient" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro — Strong reasoning" },
    { value: "openai/gpt-5-mini", label: "GPT-5 Mini — Fast OpenAI" },
    { value: "openai/gpt-5", label: "GPT-5 — Highest quality OpenAI" },
  ],
  google: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash — Fast and cost-efficient" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite — Lowest latency/cost" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro — Strong reasoning and context" },
  ],
  openai: [
    { value: "gpt-4.1", label: "GPT 4.1 — Function Calling, Image Analysis" },
    { value: "gpt-4o", label: "GPT-4o — Omni, Multimodal" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini — Fast & Efficient" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo — Large Context" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo — Economical" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini — Lightweight" },
  ],
  anthropic: [
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku — Fast and lightweight" },
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet — Balanced quality" },
    { value: "claude-3-opus-latest", label: "Claude 3 Opus — Highest capability" },
  ],
  perplexity: [
    { value: "llama-3.1-sonar-small-128k-online", label: "Sonar Small Online — Fast web-grounded" },
    { value: "llama-3.1-sonar-large-128k-online", label: "Sonar Large Online — Deeper web-grounded" },
    { value: "llama-3.1-sonar-huge-128k-online", label: "Sonar Huge Online — Highest quality web-grounded" },
  ],
};

export const DEFAULT_MODEL_BY_PROVIDER: Record<LlmProvider, string> = {
  lovable: "google/gemini-3-flash-preview",
  google: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  perplexity: "llama-3.1-sonar-small-128k-online",
};

const VALID = new Set(["lovable", "openai", "google", "anthropic", "perplexity"]);

export function getDefaultModelForProvider(provider: LlmProvider): string {
  return DEFAULT_MODEL_BY_PROVIDER[provider];
}

export function resolveLlmProviderFromConfig(cfg: unknown): LlmProvider {
  if (!cfg || typeof cfg !== "object") return DEFAULT_AGENT_LLM_PROVIDER;
  const p = (cfg as { provider?: unknown }).provider;
  if (typeof p !== "string") return DEFAULT_AGENT_LLM_PROVIDER;
  const normalized = p.trim().toLowerCase();
  if (!VALID.has(normalized)) return DEFAULT_AGENT_LLM_PROVIDER;
  return normalized as LlmProvider;
}
