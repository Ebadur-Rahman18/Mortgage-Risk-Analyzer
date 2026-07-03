// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Sparkles,
  Zap,
  Cloud,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Settings,
  MessageSquare,
  Bot,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { useIntegrationSettings } from "@/hooks/useIntegrationSettings";

const providerIcons: Record<string, React.ReactNode> = {
  openai: <Brain className="h-5 w-5" />,
  anthropic: <Sparkles className="h-5 w-5" />,
  google: <Cloud className="h-5 w-5" />,
  perplexity: <Zap className="h-5 w-5" />,
};

const providerNames: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  perplexity: "Perplexity",
};

export default function AIModelManagement() {
  const navigate = useNavigate();
  const { data: integrationSettings = [], isLoading: integrationLoading } = useIntegrationSettings();
  const aiProviders = ["openai", "anthropic", "google", "perplexity"];

  const integrationByProvider = useMemo(
    () =>
      integrationSettings.reduce<Record<string, { hasKey: boolean; isActive: boolean; validationStatus?: string | null }>>(
        (acc, setting) => {
          acc[setting.provider_name] = {
            hasKey: Boolean(setting.api_key),
            isActive: Boolean(setting.is_active),
            validationStatus: setting.validation_status,
          };
          return acc;
        },
        {}
      ),
    [integrationSettings]
  );

  const providerStats = useMemo(() => {
    return aiProviders.map((slug) => {
      const integration = integrationByProvider[slug];
      const hasKey = Boolean(integration?.hasKey);
      const isActive = hasKey && Boolean(integration?.isActive);
      return {
        slug,
        hasKey,
        isActive,
        validationStatus: integration?.validationStatus,
      };
    });
  }, [integrationByProvider]);

  const configuredCount = providerStats.filter((provider) => provider.hasKey).length;
  const activeCount = providerStats.filter((provider) => provider.isActive).length;
  const validCount = providerStats.filter((provider) => provider.validationStatus === "valid").length;
  const needsAttention = providerStats.some(
    (provider) => provider.validationStatus === "invalid" || provider.validationStatus === "error"
  );
  const primaryProvider = providerStats.find((provider) => provider.isActive) ?? providerStats.find((provider) => provider.hasKey);

  if (integrationLoading) {
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
          <h1 className="text-3xl font-bold tracking-tight">AI Model Management</h1>
          <p className="text-muted-foreground">
            Monitor provider readiness, validate connections, and control where AI features run.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/ai/llm-config")}>
            <Settings className="mr-2 h-4 w-4" />
            LLM Config
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/integrations")}>
            Manage Integrations
          </Button>
          <Button onClick={() => navigate("/admin/ai-usage")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Usage Analytics
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Providers Configured</CardDescription>
            <CardTitle className="text-2xl">{configuredCount}/4</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Providers Active</CardDescription>
            <CardTitle className="text-2xl">{activeCount}/4</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Connections Validated</CardDescription>
            <CardTitle className="text-2xl">{validCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Platform Status</CardDescription>
            <CardTitle className="text-2xl">{activeCount > 0 ? "Ready" : "Setup Needed"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {needsAttention && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Provider Validation Issues Detected
            </CardTitle>
            <CardDescription>
              At least one AI provider has an invalid or failed connection. Open Integrations and re-test API keys.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
          <CardDescription>
            Provider status comes directly from Integration Hub. Use Integrations to set API keys and test connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {providerStats.map((provider) => {
              const statusLabel = provider.hasKey
                ? provider.isActive
                  ? "Configured"
                  : "Disabled"
                : "Not configured";

              const validationLabel =
                provider.validationStatus === "valid"
                  ? "Validated"
                  : provider.validationStatus === "invalid"
                  ? "Invalid key"
                  : provider.validationStatus === "error"
                  ? "Validation error"
                  : "Not tested";
              const modelInfoLabel = provider.hasKey
                ? "Model catalog pending migration"
                : "Connect provider to enable models";

              return (
                <Card key={provider.slug} className={provider.hasKey ? "border-primary/30" : "opacity-90"}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg border p-2">{providerIcons[provider.slug]}</div>
                          <div>
                            <p className="font-semibold">{providerNames[provider.slug]}</p>
                            <p className="text-xs text-muted-foreground">{modelInfoLabel}</p>
                          </div>
                        </div>
                        <Switch disabled checked={provider.isActive} />
                      </div>

                      <div className="flex items-center justify-between border-t pt-2">
                        <Badge variant={provider.isActive ? "default" : provider.hasKey ? "secondary" : "outline"}>
                          {statusLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{validationLabel}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Routing</CardTitle>
          <CardDescription>
            Current AI features rely on active providers from Integration Hub. Advanced per-model routing activates after AI model tables are migrated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">AI Chat Assistant</span>
            </div>
            <Badge variant={activeCount > 0 ? "default" : "outline"}>
              {activeCount > 0 ? "Enabled by provider key" : "Waiting for provider setup"}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">AI Agents</span>
            </div>
            <Badge variant={activeCount > 0 ? "default" : "outline"}>
              {activeCount > 0 ? "Operational" : "Setup needed"}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Model Catalog & Pricing</span>
            </div>
            <Badge variant="secondary">Pending DB migration</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Advanced Model Management Not Yet Enabled
          </CardTitle>
          <CardDescription>
            The platform is already usable with provider integrations. To unlock model-level controls, run migrations for:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li><code>ai_providers</code> for provider metadata and defaults</li>
            <li><code>ai_models</code> for model sync, pricing, and per-feature routing</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={() => navigate("/admin/integrations")}>
              Open Integrations
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/deployment")}>
              Check Deployment
            </Button>
            {primaryProvider?.hasKey && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {providerNames[primaryProvider.slug]} is connected
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
