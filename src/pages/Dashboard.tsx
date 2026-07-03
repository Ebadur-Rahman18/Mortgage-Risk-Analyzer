import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useDashboardStats, useRecentActivity, getTimeAgo } from "@/hooks/useDashboard";
import { useHideDemoData } from "@/hooks/useHideDemoData";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  AlertTriangle,
  ListTodo,
  Users,
  ArrowUpRight,
  Clock,
  Loader2,
  FileText,
  Search,
  Shield,
  ArrowRight,
  CheckCircle2,
  BriefcaseBusiness,
  ContactRound,
  Building2,
  CheckSquare,
  Bot,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { MyPerformanceCard } from "@/components/leaderboard/MyPerformanceCard";

const quickShortcuts = [
  {
    title: "Loan Pipeline",
    description: "View all loans by status",
    icon: Banknote,
    href: "/loans",
  },
  {
    title: "Action Items",
    description: "Pending tasks to complete",
    icon: ListTodo,
    href: "/action-items",
  },
  {
    title: "Draft Document",
    description: "AI-generate a borrower email",
    icon: FileText,
    href: "/communication-center",
  },
  {
    title: "Search Knowledge",
    description: "Find docs in knowledge base",
    icon: Search,
    href: "/knowledge",
  },
];

export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role;

  if (role === "loan_officer") return <LoanOfficerDashboard />;
  if (role === "user") return <UserDashboard />;
  return <FullDashboard />;
}

function UserDashboard() {
  const { profile, user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const hideDemo = useHideDemoData();
  const showAgentCatalog = isFeatureEnabled("enableAIAgents");
  const { data: openTaskCount = 0 } = useQuery({
    queryKey: ["tasks", "open-assigned-count", user?.id, hideDemo],
    queryFn: async (): Promise<number> => {
      let q = supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", user!.id)
        .neq("status", "completed")
        .neq("status", "cancelled");
      if (hideDemo) {
        q = q.eq("is_demo", false);
      }
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {greeting()}, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-muted-foreground max-w-2xl">
          Your workspace for tasks, shared knowledge, and AI assistants enabled for your role.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/tasks" className="group">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <CheckSquare className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">My tasks</p>
                  {openTaskCount > 0 ? (
                    <Badge variant="secondary" className="text-xs">
                      {openTaskCount} open
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">Work assigned to you by the team</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/knowledge" className="group">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Knowledge base</p>
                <p className="text-sm text-muted-foreground">SOPs, products, and docs shared by loan officers</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </Link>
        {showAgentCatalog ? (
          <Link to="/agents" className="group">
            <Card className="h-full transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">AI agents</p>
                  <p className="text-sm text-muted-foreground">
                    Open the assistants available for your role
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function LoanOfficerDashboard() {
  // Loan officers see the full pipeline view but scoped via RLS in the underlying hooks.
  return <FullDashboard />;
}

function FullDashboard() {
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "loan": return Banknote;
      case "action": return ListTodo;
      case "alert": return AlertTriangle;
      case "borrower": return Users;
      default: return Clock;
    }
  };
  const noCrmSyncYet = useMemo(() => {
    if (!stats) return true;
    return !stats.crm.hubspotLastSyncAt && !stats.crm.encompassLastSyncAt;
  }, [stats]);
  const crmVolumeData = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "HubSpot Contacts", value: stats.crm.hubspotContacts, fill: "#3b82f6" },
      { label: "HubSpot Deals", value: stats.crm.hubspotDeals, fill: "#8b5cf6" },
      { label: "Encompass Records", value: stats.crm.encompassRecords, fill: "#06b6d4" },
    ];
  }, [stats]);
  const crmShareData = useMemo(
    () => crmVolumeData.filter((item) => item.value > 0),
    [crmVolumeData],
  );
  const crmTotal = useMemo(
    () => crmVolumeData.reduce((sum, item) => sum + item.value, 0),
    [crmVolumeData],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {greeting()}, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here's your mortgage operations snapshot for today.
        </p>
      </div>

      {/* KPI Cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Link to="/pipeline/hubspot" className="group">
              <Card className="stat-card-enhanced h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <ContactRound className="h-6 w-6 text-primary" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-foreground">{stats.crm.hubspotContacts}</p>
                    <p className="text-sm text-muted-foreground">HubSpot Contacts</p>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Latest synced CRM contacts
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/pipeline/hubspot#hubspot-deals" className="group">
              <Card className="stat-card-enhanced h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/10">
                      <BriefcaseBusiness className="h-6 w-6 text-violet-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-foreground">{stats.crm.hubspotDeals}</p>
                    <p className="text-sm text-muted-foreground">HubSpot Deals</p>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Latest synced CRM deals
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/pipeline/encompass" className="group">
              <Card className="stat-card-enhanced h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-500/10">
                      <Building2 className="h-6 w-6 text-sky-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-foreground">{stats.crm.encompassRecords}</p>
                    <p className="text-sm text-muted-foreground">Encompass Records</p>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Last sync returned from Encompass feed
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/action-items" className="group">
              <Card className="stat-card-enhanced h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/10">
                      <ListTodo className="h-6 w-6 text-indigo-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-foreground">{stats.actionItems.total}</p>
                    <p className="text-sm text-muted-foreground">Open Actions</p>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs">
                    {stats.actionItems.overdue > 0 ? (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {stats.actionItems.overdue} overdue
                      </Badge>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> All on track
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/borrowers" className="group">
              <Card className="stat-card-enhanced h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10">
                      <Users className="h-6 w-6 text-emerald-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-foreground">{stats.borrowers}</p>
                    <p className="text-sm text-muted-foreground">Borrowers</p>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Total in system</div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">CRM Volume by Source</CardTitle>
                <CardDescription>Comparison view for contacts, deals, and Encompass records</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                {crmTotal === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No CRM data synced yet.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={crmVolumeData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          formatter={(value: number) => [value.toLocaleString(), "Records"]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            color: "hsl(var(--card-foreground))",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {crmVolumeData.map((entry) => (
                            <Cell key={entry.label} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last HubSpot sync:{" "}
                      {stats.crm.hubspotLastSyncAt ? new Date(stats.crm.hubspotLastSyncAt).toLocaleString() : "No sync yet"}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">CRM Mix Distribution</CardTitle>
                <CardDescription>Share split including Encompass data in dashboard graph</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                {crmShareData.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No CRM data synced yet.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={crmShareData}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {crmShareData.map((entry) => (
                            <Cell key={entry.label} fill={entry.fill} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number, name: string) => {
                            const pct = crmTotal > 0 ? Math.round((value / crmTotal) * 100) : 0;
                            return [`${value.toLocaleString()} (${pct}%)`, name];
                          }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            color: "hsl(var(--card-foreground))",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
                      {crmShareData.map((entry) => (
                        <div key={entry.label} className="flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                          <span className="text-muted-foreground">{entry.label}:</span>
                          <span className="font-medium">{entry.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last Encompass sync:{" "}
                      {stats.crm.encompassLastSyncAt ? new Date(stats.crm.encompassLastSyncAt).toLocaleString() : "No sync yet"}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* Quick Actions + Alerts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
              <CardDescription>Jump to common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickShortcuts.map((action) => (
                  <Link
                    key={action.href}
                    to={action.href}
                    className="group flex items-center gap-4 rounded-lg border border-border/50 p-4 transition-all duration-200 hover:border-border hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts summary */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">Alerts</CardTitle>
              <Shield className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {stats && noCrmSyncYet && (
              <Link
                to="/admin/integrations"
                className="flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <Shield className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">CRM sync not run yet</p>
                  <p className="text-xs text-muted-foreground">Run HubSpot or Encompass sync to populate dashboard counters</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            {stats && stats.actionItems.overdue > 0 && (
              <Link
                to="/action-items"
                className="flex items-center gap-3 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 p-3 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/30"
              >
                <ListTodo className="h-4 w-4 shrink-0 text-orange-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Overdue actions</p>
                  <p className="text-xs text-muted-foreground">{stats.actionItems.overdue} action(s) past due date</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            {stats && !noCrmSyncYet && stats.actionItems.overdue === 0 && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-sm text-muted-foreground">No urgent alerts — all clear.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Performance */}
      <MyPerformanceCard />

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
          <CardDescription>Latest updates across loans, actions, and borrowers</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !recentActivity || recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentActivity.map((item) => {
                const Icon = getActivityIcon(item.type);
                return (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border/50 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                      <p className="text-xs text-muted-foreground">{getTimeAgo(item.time)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
