// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  Brain,
  Download,
  Loader2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useHideDemoData } from "@/hooks/useHideDemoData";

type DateRange = "7d" | "30d" | "month";

type RunRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  provider_used: string | null;
  model_used: string | null;
  input: string | null;
  output: string | null;
  context: unknown;
  token_metrics: unknown;
  metadata: unknown;
};

type UsageEntry = {
  id: string;
  createdAt: string;
  userId: string | null;
  provider: string;
  model: string;
  tokens: number;
  cost: number;
  isEstimatedCost: boolean;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getRangeStart(dateRange: DateRange): string {
  const now = new Date();

  if (dateRange === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString();
  }

  const daysBack = dateRange === "7d" ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - daysBack);
  return start.toISOString();
}

function extractNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickFirstNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = extractNumber(value, -1);
    if (parsed >= 0) return parsed;
  }
  return -1;
}

function estimateTokensFromText(value: string | null | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  // Rough heuristic: ~4 characters per token for English text.
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function parseUsage(run: RunRow): UsageEntry {
  const tokenMetrics = toRecord(run.token_metrics);
  const metadata = toRecord(run.metadata);
  const context = toRecord(run.context);
  const usageFromMetadata = toRecord(metadata?.usage);
  const messagesFromContext = Array.isArray(context?.messages) ? context?.messages : [];
  const promptTextFromContext = messagesFromContext
    .filter((msg) => toRecord(msg)?.role === "user")
    .map((msg) => {
      const obj = toRecord(msg);
      return typeof obj?.content === "string" ? obj.content : "";
    })
    .join(" ");
  const outputTextFromContext = messagesFromContext
    .filter((msg) => toRecord(msg)?.role === "assistant")
    .map((msg) => {
      const obj = toRecord(msg);
      return typeof obj?.content === "string" ? obj.content : "";
    })
    .join(" ");

  const promptTokens = Math.max(
    0,
    pickFirstNumber(
      tokenMetrics?.prompt_tokens,
      tokenMetrics?.promptTokens,
      tokenMetrics?.input_tokens,
      tokenMetrics?.inputTokens,
      metadata?.prompt_tokens,
      metadata?.promptTokens,
      metadata?.input_tokens,
      metadata?.inputTokens,
      usageFromMetadata?.prompt_tokens,
      usageFromMetadata?.promptTokens,
      usageFromMetadata?.input_tokens,
      usageFromMetadata?.inputTokens
    )
  );

  const completionTokens = Math.max(
    0,
    pickFirstNumber(
      tokenMetrics?.completion_tokens,
      tokenMetrics?.completionTokens,
      tokenMetrics?.output_tokens,
      tokenMetrics?.outputTokens,
      metadata?.completion_tokens,
      metadata?.completionTokens,
      metadata?.output_tokens,
      metadata?.outputTokens,
      usageFromMetadata?.completion_tokens,
      usageFromMetadata?.completionTokens,
      usageFromMetadata?.output_tokens,
      usageFromMetadata?.outputTokens
    )
  );

  const tokenCandidates = [
    tokenMetrics?.total_tokens,
    tokenMetrics?.totalTokens,
    tokenMetrics?.tokens,
    metadata?.total_tokens,
    metadata?.totalTokens,
    metadata?.tokens,
    usageFromMetadata?.total_tokens,
    usageFromMetadata?.totalTokens,
    usageFromMetadata?.tokens,
  ];
  const costCandidates = [
    tokenMetrics?.total_cost,
    tokenMetrics?.totalCost,
    tokenMetrics?.cost,
    metadata?.total_cost,
    metadata?.totalCost,
    metadata?.cost,
    usageFromMetadata?.total_cost,
    usageFromMetadata?.totalCost,
    usageFromMetadata?.cost,
  ];

  const tokensFromField = tokenCandidates.map((v) => extractNumber(v, -1)).find((v) => v >= 0) ?? -1;
  const tokensFromSplit = promptTokens + completionTokens;
  const estimatedPromptTokensFromText =
    estimateTokensFromText(run.input) || estimateTokensFromText(promptTextFromContext);
  const estimatedCompletionTokensFromText =
    estimateTokensFromText(run.output) || estimateTokensFromText(outputTextFromContext);
  const tokensFromText = estimatedPromptTokensFromText + estimatedCompletionTokensFromText;
  const tokens =
    tokensFromField >= 0 ? tokensFromField : tokensFromSplit > 0 ? tokensFromSplit : tokensFromText;
  const explicitCost = costCandidates.map((v) => extractNumber(v, -1)).find((v) => v >= 0) ?? -1;

  const model = run.model_used || "unknown";
  const normalizedModel = model.toLowerCase();
  // Pricing per 1k tokens. Covers Lovable AI Gateway (slash-prefixed) + direct providers.
  const pricingByModel: Array<{ key: string; inputPer1k: number; outputPer1k: number }> = [
    // OpenAI
    { key: "gpt-5-nano", inputPer1k: 0.00005, outputPer1k: 0.0004 },
    { key: "gpt-5-mini", inputPer1k: 0.00025, outputPer1k: 0.002 },
    { key: "gpt-5", inputPer1k: 0.00125, outputPer1k: 0.01 },
    { key: "gpt-4.1-mini", inputPer1k: 0.0004, outputPer1k: 0.0016 },
    { key: "gpt-4.1", inputPer1k: 0.002, outputPer1k: 0.008 },
    { key: "gpt-4o-mini", inputPer1k: 0.00015, outputPer1k: 0.0006 },
    { key: "gpt-4o", inputPer1k: 0.0025, outputPer1k: 0.01 },
    { key: "gpt-4", inputPer1k: 0.03, outputPer1k: 0.06 },
    { key: "gpt-3.5", inputPer1k: 0.0005, outputPer1k: 0.0015 },
    // Google Gemini (Lovable AI uses google/gemini-*)
    { key: "gemini-3-pro", inputPer1k: 0.00125, outputPer1k: 0.01 },
    { key: "gemini-3-flash", inputPer1k: 0.0001, outputPer1k: 0.0004 },
    { key: "gemini-3.1-flash-lite", inputPer1k: 0.00005, outputPer1k: 0.0002 },
    { key: "gemini-3.1-flash", inputPer1k: 0.0001, outputPer1k: 0.0004 },
    { key: "gemini-3.5-flash", inputPer1k: 0.00015, outputPer1k: 0.0006 },
    { key: "gemini-2.5-pro", inputPer1k: 0.00125, outputPer1k: 0.01 },
    { key: "gemini-2.5-flash-lite", inputPer1k: 0.00005, outputPer1k: 0.0002 },
    { key: "gemini-2.5-flash", inputPer1k: 0.000075, outputPer1k: 0.0003 },
    { key: "gemini-2.0-flash-lite", inputPer1k: 0.000075, outputPer1k: 0.0003 },
    { key: "gemini-2.0-flash", inputPer1k: 0.0001, outputPer1k: 0.0004 },
    { key: "gemini-1.5-pro", inputPer1k: 0.00125, outputPer1k: 0.005 },
    { key: "gemini", inputPer1k: 0.0001, outputPer1k: 0.0004 },
    // Anthropic
    { key: "claude-3-opus", inputPer1k: 0.015, outputPer1k: 0.075 },
    { key: "claude-3-5-sonnet", inputPer1k: 0.003, outputPer1k: 0.015 },
    { key: "claude-3-5-haiku", inputPer1k: 0.0008, outputPer1k: 0.004 },
    { key: "claude", inputPer1k: 0.003, outputPer1k: 0.015 },
    // Perplexity Sonar
    { key: "sonar-huge", inputPer1k: 0.005, outputPer1k: 0.005 },
    { key: "sonar-large", inputPer1k: 0.001, outputPer1k: 0.001 },
    { key: "sonar-small", inputPer1k: 0.0002, outputPer1k: 0.0002 },
    { key: "sonar", inputPer1k: 0.0002, outputPer1k: 0.0002 },
  ];
  const matchedPricing =
    pricingByModel.find((p) => normalizedModel.includes(p.key)) ??
    { key: "default", inputPer1k: 0.00015, outputPer1k: 0.0006 };

  const effectivePromptTokens = promptTokens > 0 ? promptTokens : estimatedPromptTokensFromText;
  const effectiveCompletionTokens =
    completionTokens > 0 ? completionTokens : estimatedCompletionTokensFromText;
  const hasPromptCompletion = effectivePromptTokens > 0 || effectiveCompletionTokens > 0;
  const estimatedCostFromPromptCompletion =
    (effectivePromptTokens / 1000) * matchedPricing.inputPer1k +
    (effectiveCompletionTokens / 1000) * matchedPricing.outputPer1k;
  const estimatedCostFromTotalOnly = (tokens / 1000) * matchedPricing.inputPer1k;
  const estimatedCost = hasPromptCompletion
    ? estimatedCostFromPromptCompletion
    : estimatedCostFromTotalOnly;
  const isEstimatedCost = explicitCost < 0;
  const cost = explicitCost >= 0 ? explicitCost : estimatedCost;

  // Detect provider. Lovable AI Gateway models look like "google/gemini-*", "openai/gpt-*", etc.
  // Treat slash-prefixed models as Lovable AI; otherwise infer from model name.
  function inferProvider(): string {
    if (run.provider_used) return run.provider_used;
    if (model.includes("/")) return "lovable";
    if (
      normalizedModel.includes("gpt") ||
      normalizedModel.startsWith("o1") ||
      normalizedModel.startsWith("o3")
    ) return "openai";
    if (normalizedModel.includes("gemini")) return "google";
    if (normalizedModel.includes("claude")) return "anthropic";
    if (normalizedModel.includes("sonar") || normalizedModel.includes("llama")) return "perplexity";
    return "unknown";
  }
  const inferredProvider = inferProvider();

  return {
    id: run.id,
    createdAt: run.created_at,
    userId: run.user_id,
    provider: inferredProvider,
    model,
    tokens,
    cost,
    isEstimatedCost,
  };
}

export default function AIUsageAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const hideDemo = useHideDemoData();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("ai-usage-analytics-runs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ai-usage-analytics"] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const {
    data: usageData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["ai-usage-analytics", dateRange, hideDemo],
    queryFn: async () => {
      const rangeStart = getRangeStart(dateRange);

      // Source AI usage from agent_messages (assistant turns include model + token_metrics)
      // joined to agent_conversations for user_id. Covers Lovable AI Gateway and every
      // other LLM provider that writes through run-ai-agent.
      const { data: messages, error: messagesError } = await supabase
        .from("agent_messages")
        .select("id, created_at, role, content, model_used, token_metrics, conversation_id, agent_conversations!inner(user_id)")
        .eq("role", "assistant")
        .gte("created_at", rangeStart)
        .order("created_at", { ascending: false })
        .limit(500);

      if (messagesError) throw messagesError;

      const runs: RunRow[] = (messages ?? []).map((m: any) => ({
        id: m.id,
        created_at: m.created_at,
        user_id: m.agent_conversations?.user_id ?? null,
        provider_used: null,
        model_used: m.model_used ?? null,
        input: null,
        output: typeof m.content === "string" ? m.content : null,
        context: null,
        token_metrics: m.token_metrics ?? null,
        metadata: null,
      }));

      const normalizedRuns = runs.map(parseUsage);
      const uniqueUserIds = Array.from(
        new Set(normalizedRuns.map((run) => run.userId).filter((id): id is string => !!id))
      );

      let userMap: Record<string, string> = {};
      if (uniqueUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", uniqueUserIds);

        if (profilesError) throw profilesError;

        userMap = (profiles ?? []).reduce<Record<string, string>>((acc, profile) => {
          const displayName = profile.full_name || profile.email || "Unknown user";
          acc[profile.id] = displayName;
          return acc;
        }, {});
      }

      return { runs: normalizedRuns, userMap };
    },
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    staleTime: 0,
    refetchInterval: 10_000,
  });

  const summary = useMemo(() => {
    const runs = usageData?.runs ?? [];
    const totalCost = runs.reduce((sum, run) => sum + run.cost, 0);
    const totalTokens = runs.reduce((sum, run) => sum + run.tokens, 0);
    const totalRequests = runs.length;
    const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;
    const estimatedCostRequests = runs.filter((run) => run.isEstimatedCost).length;

    return { totalCost, totalTokens, totalRequests, avgCostPerRequest, estimatedCostRequests };
  }, [usageData]);

  const providerStats = useMemo(() => {
    const stats = new Map<string, { requests: number; cost: number; tokens: number }>();
    for (const run of usageData?.runs ?? []) {
      const key = run.provider;
      const current = stats.get(key) ?? { requests: 0, cost: 0, tokens: 0 };
      current.requests += 1;
      current.cost += run.cost;
      current.tokens += run.tokens;
      stats.set(key, current);
    }

    return Array.from(stats.entries())
      .map(([provider, value]) => ({ provider, ...value }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 6);
  }, [usageData]);

  const modelStats = useMemo(() => {
    const stats = new Map<string, number>();
    for (const run of usageData?.runs ?? []) {
      stats.set(run.model, (stats.get(run.model) ?? 0) + 1);
    }

    return Array.from(stats.entries())
      .map(([model, requests]) => ({ model, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 6);
  }, [usageData]);

  const handleExportCsv = () => {
    const rows = usageData?.runs ?? [];
    if (rows.length === 0) {
      toast.error("No usage data available to export");
      return;
    }

    const csvHeaders = ["Date", "User", "Provider", "Model", "Tokens", "Cost"];
    const csvRows = rows.map((run) => {
      const userName = run.userId ? usageData?.userMap?.[run.userId] || run.userId : "System";
      return [
        dateFormatter.format(new Date(run.createdAt)),
        userName,
        run.provider,
        run.model,
        String(run.tokens),
        run.cost.toFixed(6),
      ];
    });

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ai-usage-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Usage Analytics</h1>
          <p className="text-muted-foreground">
            Monitor AI usage, costs, and performance across your platform
          </p>
        </div>
        <div className="flex gap-2">
          <SearchableSelect
            value={dateRange}
            onChange={(value) => setDateRange(value as DateRange)}
            className="w-[180px]"
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "month", label: "This month" },
            ]}
          />
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading analytics data...
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Failed to load AI analytics: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(summary.totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              {dateRange === "7d" ? "Last 7 days" : dateRange === "30d" ? "Last 30 days" : "This month"}
            </p>
            {summary.estimatedCostRequests > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Estimated from tokens for {summary.estimatedCostRequests} request(s)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all models</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">API calls made</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost/Request</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.avgCostPerRequest.toFixed(6)}</div>
            <p className="text-xs text-muted-foreground">Per API call</p>
          </CardContent>
        </Card>
      </div>

      {/* Provider and Model Usage */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost by Provider</CardTitle>
            <CardDescription>Breakdown of costs across AI providers</CardDescription>
          </CardHeader>
          <CardContent>
            {providerStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data for selected range</p>
            ) : (
              <div className="space-y-3">
                {providerStats.map((item) => (
                  <div key={item.provider} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.provider}</Badge>
                      <span className="text-muted-foreground">{item.requests} req</span>
                    </div>
                    <span className="font-medium">{currencyFormatter.format(item.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Popularity</CardTitle>
            <CardDescription>Most frequently used models</CardDescription>
          </CardHeader>
          <CardContent>
            {modelStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data for selected range</p>
            ) : (
              <div className="space-y-3">
                {modelStats.map((item) => (
                  <div key={item.model} className="flex items-center justify-between text-sm">
                    <Badge variant="outline">{item.model}</Badge>
                    <span className="text-muted-foreground">{item.requests} requests</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Usage Log</CardTitle>
          <CardDescription>Recent AI usage across your platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usageData?.runs ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No usage data for the selected range.
                  </TableCell>
                </TableRow>
              ) : (
                usageData!.runs.slice(0, 25).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{dateFormatter.format(new Date(run.createdAt))}</TableCell>
                    <TableCell>{run.userId ? usageData?.userMap?.[run.userId] || "Unknown user" : "System"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{run.provider}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.model}</Badge>
                    </TableCell>
                    <TableCell>{run.tokens.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{currencyFormatter.format(run.cost)}</span>
                        {run.isEstimatedCost && <Badge variant="outline">Est.</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
