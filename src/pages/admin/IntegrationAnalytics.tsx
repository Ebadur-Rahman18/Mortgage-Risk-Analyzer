import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Activity,
  DollarSign,
  TrendingUp,
  Download,
  Clock,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type DateRange = '7d' | '30d' | '90d' | 'all';

type IntegrationSettingRow = {
  provider_name: string;
  is_active: boolean | null;
  validation_status: string | null;
};

type EdgeFunctionRow = {
  id: string;
  name: string;
  status: string | null;
  invocation_count: number | null;
  last_invoked_at: string | null;
};

type AgentRunRow = {
  id: string;
  created_at: string;
  provider_used: string | null;
  latency_ms: number | null;
  token_metrics: unknown;
  metadata: unknown;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

function getRangeStart(dateRange: DateRange): string | null {
  if (dateRange === 'all') return null;

  const now = new Date();
  const daysBack = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
  const start = new Date(now);
  start.setDate(now.getDate() - daysBack);
  return start.toISOString();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export default function IntegrationAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const {
    data: analyticsData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['integration-analytics', dateRange],
    queryFn: async () => {
      const rangeStart = getRangeStart(dateRange);

      const [
        { data: integrationSettings, error: integrationError },
        { data: edgeFunctions, error: edgeFunctionsError },
        { data: aiRuns, error: aiRunsError },
      ] = await Promise.all([
        supabase
          .from('integration_settings')
          .select('provider_name, is_active, validation_status'),
        supabase
          .from('edge_functions')
          .select('id, name, status, invocation_count, last_invoked_at'),
        rangeStart
          ? supabase
              .from('ai_agent_runs')
              .select('id, created_at, provider_used, latency_ms, token_metrics, metadata')
              .gte('created_at', rangeStart)
          : supabase
              .from('ai_agent_runs')
              .select('id, created_at, provider_used, latency_ms, token_metrics, metadata'),
      ]);

      if (integrationError) throw integrationError;
      if (edgeFunctionsError) throw edgeFunctionsError;
      if (aiRunsError) throw aiRunsError;

      const runs = (aiRuns ?? []) as AgentRunRow[];
      const settings = (integrationSettings ?? []) as IntegrationSettingRow[];
      const functions = (edgeFunctions ?? []) as EdgeFunctionRow[];

      const totalApiCalls = functions.reduce((sum, fn) => sum + (fn.invocation_count ?? 0), 0);
      const successfulCalls = runs.filter((run) => {
        const metadata = toRecord(run.metadata);
        const status = metadata?.status;
        if (typeof status === 'string') {
          return status.toLowerCase() === 'success' || status.toLowerCase() === 'completed';
        }
        return true;
      }).length;
      const failedCalls = Math.max(0, runs.length - successfulCalls);
      const successRate = runs.length > 0 ? (successfulCalls / runs.length) * 100 : 0;

      const totalCost = runs.reduce((sum, run) => {
        const tokenMetrics = toRecord(run.token_metrics);
        const metadata = toRecord(run.metadata);
        const cost =
          extractNumber(tokenMetrics?.total_cost, -1) >= 0
            ? extractNumber(tokenMetrics?.total_cost, 0)
            : extractNumber(tokenMetrics?.cost, -1) >= 0
              ? extractNumber(tokenMetrics?.cost, 0)
              : extractNumber(metadata?.total_cost, -1) >= 0
                ? extractNumber(metadata?.total_cost, 0)
                : extractNumber(metadata?.cost, 0);
        return sum + cost;
      }, 0);

      const avgResponseTime =
        runs.length > 0
          ? Math.round(
              runs.reduce((sum, run) => sum + (run.latency_ms ?? 0), 0) / runs.length
            )
          : 0;

      const providerBreakdown = settings.map((setting) => {
        const providerKey = setting.provider_name.toLowerCase();
        const callsForProvider = runs.filter(
          (run) => (run.provider_used ?? 'unknown').toLowerCase() === providerKey
        );
        return {
          provider: setting.provider_name,
          isActive: !!setting.is_active,
          validationStatus: setting.validation_status ?? 'unknown',
          recentCalls: callsForProvider.length,
        };
      });

      const activeIntegrations = settings.filter((setting) => setting.is_active).length;
      return {
        totalApiCalls,
        successRate,
        totalCost,
        avgResponseTime,
        recentTrackedCalls: runs.length,
        failedCalls,
        providerBreakdown,
        activeIntegrations,
      };
    },
  });

  const dateLabel = useMemo(() => {
    if (dateRange === '7d') return 'Last 7 days';
    if (dateRange === '30d') return 'Last 30 days';
    if (dateRange === '90d') return 'Last 90 days';
    return 'All time';
  }, [dateRange]);

  const handleExportCsv = () => {
    const providerBreakdown = analyticsData?.providerBreakdown ?? [];
    if (providerBreakdown.length === 0) {
      toast.error('No integration analytics data to export');
      return;
    }

    const headers = ['Provider', 'Active', 'Validation Status', 'Recent Calls'];
    const rows = providerBreakdown.map((item) => [
      item.provider,
      item.isActive ? 'Yes' : 'No',
      item.validationStatus,
      String(item.recentCalls),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `integration-analytics-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <h1 className="text-3xl font-bold tracking-tight">Integration Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Monitor usage, costs, and performance across all integrations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading integration analytics...
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Failed to load integration analytics:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter analytics by date range, category, and provider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <SearchableSelect
                value={dateRange}
                onChange={(value) => setDateRange(value as DateRange)}
                options={[
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                  { value: '90d', label: 'Last 90 days' },
                  { value: 'all', label: 'All time' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analyticsData?.totalApiCalls ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total recorded edge-function invocations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analyticsData?.successRate ?? 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on tracked runs ({dateLabel.toLowerCase()})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencyFormatter.format(analyticsData?.totalCost ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Estimated from tracked AI usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.avgResponseTime ?? 0}ms</div>
            <p className="text-xs text-muted-foreground mt-1">
              From tracked AI runs ({dateLabel.toLowerCase()})
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Breakdown</CardTitle>
          <CardDescription>Status and recent activity by configured provider</CardDescription>
        </CardHeader>
        <CardContent>
          {(analyticsData?.providerBreakdown?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No provider configuration found.</p>
          ) : (
            <div className="space-y-3">
              {analyticsData?.providerBreakdown.map((provider) => (
                <div key={provider.provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={provider.isActive ? 'default' : 'secondary'}>
                      {provider.provider}
                    </Badge>
                    <Badge variant="outline">{provider.validationStatus}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {provider.recentCalls.toLocaleString()} recent calls
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
