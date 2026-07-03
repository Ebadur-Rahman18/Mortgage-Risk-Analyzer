import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Settings2,
  Sparkles,
  Brain,
  Cloud,
  Bot,
  Gem,
  Info,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import OpenAIIntegrationCard from "@/components/admin/OpenAIIntegrationCard";
import AIProviderIntegrationCard, {
  type AIProviderCardConfig,
} from "@/components/admin/AIProviderIntegrationCard";
import { useIntegrationSettings } from "@/hooks/useIntegrationSettings";
import {
  AI_MODELS_BY_PROVIDER,
  DEFAULT_AGENT_LLM_PROVIDER,
  type LlmProvider,
} from "@/lib/aiAgentProviders";

const OPTIONAL_PROVIDERS: AIProviderCardConfig[] = [
  {
    providerSlug: "google",
    displayName: "Google Gemini",
    description: "Gemini models — fast, cost-efficient, multimodal",
    icon: <Cloud className="h-6 w-6" />,
    iconBgClass: "bg-blue-100 dark:bg-blue-900/20",
    iconColorClass: "text-blue-600 dark:text-blue-400",
    apiKeyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    docsLabel: "Google AI Studio",
    activeFeatures: "AI Agents (Gemini), knowledge search",
  },
  {
    providerSlug: "anthropic",
    displayName: "Anthropic Claude",
    description: "Claude models — long context and careful reasoning",
    icon: <Sparkles className="h-6 w-6" />,
    iconBgClass: "bg-amber-100 dark:bg-amber-900/20",
    iconColorClass: "text-amber-600 dark:text-amber-400",
    apiKeyPlaceholder: "sk-ant-api03-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    docsLabel: "Anthropic Console",
    activeFeatures: "AI Agents (Claude), document analysis",
  },
];

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  lovable: "Lovable AI",
  openai: "OpenAI",
  google: "Google",
  anthropic: "Anthropic",
  perplexity: "Perplexity",
};

function LovableProviderCard() {
  const models = AI_MODELS_BY_PROVIDER.lovable;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border bg-background p-2">
              <Gem className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Lovable AI</CardTitle>
              <CardDescription>Default free LLM — no API key required</CardDescription>
            </div>
          </div>
          <Badge className="gap-1 shrink-0">
            <CheckCircle2 className="h-3 w-3" />
            Always on
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Agents use the Lovable AI Gateway (<code className="text-xs">LOVABLE_API_KEY</code> in Supabase
          Edge) until you connect your own provider in the cards below. New agents default to Lovable.
        </p>
        <div>
          <p className="mb-2 text-sm font-medium">Available models ({models.length})</p>
          <ul className="space-y-1.5">
            {models.map((m) => (
              <li
                key={m.value}
                className="rounded-md border bg-background/80 px-3 py-2 text-sm text-muted-foreground"
              >
                {m.label}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LLMConfig() {
  const navigate = useNavigate();
  const { data: integrationSettings = [], isLoading } = useIntegrationSettings();

  const configuredOptional = useMemo(() => {
    const slugs = new Set(["openai", "google", "anthropic"]);
    return integrationSettings.filter(
      (s) => slugs.has(s.provider_name) && s.is_active && Boolean(s.api_key)
    );
  }, [integrationSettings]);

  const totalModels =
    AI_MODELS_BY_PROVIDER.lovable.length +
    configuredOptional.reduce(
      (sum, s) =>
        sum + (AI_MODELS_BY_PROVIDER[s.provider_name as LlmProvider]?.length ?? 0),
      0
    );

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Settings2 className="h-8 w-8" />
            LLM Configuration
          </h1>
          <p className="text-muted-foreground">
            Connect optional providers or use Lovable AI (default) for all agents and chat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/agents">
              <Bot className="mr-2 h-4 w-4" />
              AI Agents
            </Link>
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/integrations")}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Full Integration Hub
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Default provider</CardDescription>
            <CardTitle className="text-xl">{PROVIDER_LABELS[DEFAULT_AGENT_LLM_PROVIDER]}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your providers connected</CardDescription>
            <CardTitle className="text-xl">{configuredOptional.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Models available to agents</CardDescription>
            <CardTitle className="text-xl">{totalModels}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Lovable AI is always available</AlertTitle>
        <AlertDescription>
          No setup required for the default gateway. Connect OpenAI, Google, or Anthropic below to use
          your own keys and billing; agents with an explicit provider in their config will use yours when
          the key is active, otherwise routing falls back to Lovable.
        </AlertDescription>
      </Alert>

      <LovableProviderCard />

      <Separator />

      <div>
        <h2 className="text-lg font-semibold">Optional providers</h2>
        <p className="text-sm text-muted-foreground">
          Save and test API keys here. Keys are stored in <code className="text-xs">integration_settings</code>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <OpenAIIntegrationCard />
        {OPTIONAL_PROVIDERS.map((config) => (
          <AIProviderIntegrationCard key={config.providerSlug} config={config} />
        ))}
      </div>
    </div>
  );
}
