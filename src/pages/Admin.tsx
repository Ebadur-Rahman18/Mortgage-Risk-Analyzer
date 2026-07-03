import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Shield,
  Settings,
  Activity,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  FileText,
  Clock3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminSystemHealth } from "@/hooks/useAdminSystemHealth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getSupabaseDashboardLinks } from "@/integrations/supabase/public-config";
import { useAuth } from "@/contexts/AuthContext";

export default function Admin() {
  const { user } = useAuth();
  const supabaseDash = getSupabaseDashboardLinks();

  const { data: mortgageOpsStats, isLoading: isLoadingMortgageOps, error: mortgageOpsError } = useQuery({
    queryKey: ["admin-mortgage-ops-cards"],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);

      const inThirtyDays = new Date(startOfToday);
      inThirtyDays.setDate(inThirtyDays.getDate() + 30);

      const inSevenDays = new Date(startOfToday);
      inSevenDays.setDate(inSevenDays.getDate() + 7);

      const { data: loanRows, error: loanError } = await supabase
        .from("loans")
        .select("status, created_at, lock_expiration_date");

      if (loanError) throw loanError;

      const terminalStatuses = new Set(["closed", "denied", "withdrawn"]);
      const activePipelineCount = (loanRows ?? []).filter((loan) => !terminalStatuses.has(loan.status)).length;

      const thirtyDaysAgoIso = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const newApplications30d = (loanRows ?? []).filter((loan) => {
        return loan.created_at >= thirtyDaysAgoIso;
      }).length;

      const expiringLocks7d = (loanRows ?? []).filter((loan) => {
        if (!loan.lock_expiration_date) return false;
        if (terminalStatuses.has(loan.status)) return false;
        const lockExpiry = new Date(loan.lock_expiration_date);
        return lockExpiry >= startOfToday && lockExpiry <= inSevenDays;
      }).length;

      const { count: overdueLoanTasksCount, error: taskError } = await supabase
        .from("action_items")
        .select("id", { count: "exact", head: true })
        .not("loan_id", "is", null)
        .in("status", ["not_started", "in_progress", "blocked", "on_hold"])
        .not("due_date", "is", null)
        .lt("due_date", startOfToday.toISOString().split("T")[0]);

      if (taskError) throw taskError;

      const upcomingLockExpirations30d = (loanRows ?? []).filter((loan) => {
        if (!loan.lock_expiration_date) return false;
        if (terminalStatuses.has(loan.status)) return false;
        const lockExpiry = new Date(loan.lock_expiration_date);
        return lockExpiry >= startOfToday && lockExpiry <= inThirtyDays;
      }).length;

      return {
        activePipelineCount,
        newApplications30d,
        expiringLocks7d,
        overdueLoanTasksCount: overdueLoanTasksCount ?? 0,
        upcomingLockExpirations30d,
      };
    },
    staleTime: 30000,
  });

  const { data: pendingFeedbackCount = 0 } = useQuery({
    queryKey: ["admin-pending-feedback-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 30000,
  });

  const { data: recentNotifications = [] } = useQuery({
    queryKey: ["admin-recent-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, created_at, type, is_read, link")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const {
    data: healthData,
    isLoading: isLoadingHealth,
    error: healthError,
  } = useAdminSystemHealth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const handleRefreshStats = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-mortgage-ops-cards"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-system-health"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-pending-feedback-count"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-recent-notifications"] });
    toast({
      title: "Statistics Refreshed",
      description: "Admin dashboard statistics have been updated.",
    });
  };

  const stats = [
    {
      title: "Active Pipeline",
      value: mortgageOpsStats?.activePipelineCount.toString() || "0",
      change: "Loans not in terminal status",
      icon: Activity,
      isLoading: isLoadingMortgageOps,
      href: "/loans",
    },
    {
      title: "New Applications (30d)",
      value: mortgageOpsStats?.newApplications30d.toString() || "0",
      change: "Loan records created in last 30 days",
      icon: FileText,
      isLoading: isLoadingMortgageOps,
      href: "/loans?createdDays=30",
    },
    {
      title: "Rate Locks Expiring (7d)",
      value: mortgageOpsStats?.expiringLocks7d.toString() || "0",
      change: `${mortgageOpsStats?.upcomingLockExpirations30d || 0} expiring in 30 days`,
      icon: Clock3,
      isLoading: isLoadingMortgageOps,
      href: "/loans?lockExpiresDays=7",
    },
    {
      title: "Overdue Loan Tasks",
      value: mortgageOpsStats?.overdueLoanTasksCount.toString() || "0",
      change: "Open, past-due action items linked to loans",
      icon: AlertCircle,
      isLoading: isLoadingMortgageOps,
      href: "/action-items?view=overdue",
    },
  ];

  const systemHealthRows = healthData
    ? [
        { service: "Supabase Database", ok: healthData.database.ok, detail: healthData.database.detail },
        { service: "Authentication", ok: healthData.auth.ok, detail: healthData.auth.detail },
        { service: "Storage", ok: healthData.storage.ok, detail: healthData.storage.detail },
        {
          service: "Edge Functions",
          ok: healthData.edgeFunctions.ok,
          detail: healthData.edgeFunctions.detail,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage users, settings, and system configuration
          </p>
        </div>
        <Button
          onClick={handleRefreshStats}
          disabled={isLoadingMortgageOps}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoadingMortgageOps ? "animate-spin" : ""}`} />
          Refresh Stats
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} to={stat.href} className="block">
              <Card className="transition-colors hover:bg-accent/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {stat.isLoading ? (
                  <>
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.change}</p>
                  </>
                )}
              </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      
      {/* Error message if stats fail to load */}
      {mortgageOpsError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Failed to load mortgage operations metrics. Please try refreshing the page.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">View All Users</p>
                <p className="text-sm text-muted-foreground">Manage user accounts</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/users">View</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Roles & Permissions</p>
                <p className="text-sm text-muted-foreground">Manage access levels</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/roles">Manage</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Activity Logs</p>
                <p className="text-sm text-muted-foreground">Monitor user activity</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/logs">View Logs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>Configure system parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">System Settings</p>
                <p className="text-sm text-muted-foreground">Platform configuration</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/settings">Configure</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Integrations</p>
                <p className="text-sm text-muted-foreground">Third-party API connections</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/integrations">Configure</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Deployment Status</p>
                <p className="text-sm text-muted-foreground">Monitor edge functions</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/deployment">View Status</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback Management
            {pendingFeedbackCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingFeedbackCount} pending
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Review and manage user feedback</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">All Feedback</p>
              <p className="text-sm text-muted-foreground">Bug reports, features & suggestions</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/feedback">Manage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>
            Live checks from your browser session
            {healthData && (
              <span className="block text-xs mt-1">
                Last verified: {new Date(healthData.checkedAt).toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthError && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to run health checks. Try refresh.
            </div>
          )}
          <div className="space-y-3">
            {isLoadingHealth ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (
              systemHealthRows.map((row) => (
                <div
                  key={row.service}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        row.ok ? "bg-green-500/15" : "bg-destructive/15"
                      }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${row.ok ? "bg-green-500" : "bg-destructive"}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{row.service}</p>
                      <p className="text-sm text-muted-foreground truncate" title={row.detail}>
                        {row.detail}
                      </p>
                    </div>
                  </div>
                  <Badge variant={row.ok ? "secondary" : "destructive"} className="shrink-0 ml-2">
                    {row.ok ? "OK" : "Issue"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>
            Security settings and audit logs
            {supabaseDash.ref && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Supabase project:{" "}
                <a
                  href={supabaseDash.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-primary underline-offset-4 hover:underline"
                >
                  {supabaseDash.ref}
                </a>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Activity Logs</p>
              <p className="text-sm text-muted-foreground">In-app audit history and platform request logs</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/logs">App logs</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={supabaseDash.logsExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-1"
                >
                  Supabase logs
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Row Level Security</p>
              <p className="text-sm text-muted-foreground">Table policies in the Supabase Database editor</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href={supabaseDash.databaseTablesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1"
              >
                Open tables
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">API Access</p>
              <p className="text-sm text-muted-foreground">Project URL, anon key, and service role</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href={supabaseDash.apiSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1"
              >
                API settings
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts — in-app notifications for the signed-in user */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Recent Alerts
          </CardTitle>
          <CardDescription>Latest in-app notifications for your account</CardDescription>
        </CardHeader>
        <CardContent>
          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                System and integration alerts appear here when sent to you
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {recentNotifications.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-col gap-1 rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{n.title}</span>
                    {!n.is_read && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{n.message}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {n.type && <span className="capitalize">Type: {n.type}</span>}
                    {n.link && (
                      <a
                        href={n.link}
                        className="text-primary underline-offset-4 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open link
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
