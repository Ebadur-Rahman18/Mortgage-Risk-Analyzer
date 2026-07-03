import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { demoLoanSourcesInList } from "@/lib/demoData";
import { useHideDemoData } from "@/hooks/useHideDemoData";

export interface DashboardStats {
  crm: {
    hubspotContacts: number;
    hubspotDeals: number;
    encompassRecords: number;
    hubspotLastSyncAt: string | null;
    encompassLastSyncAt: string | null;
  };
  actionItems: {
    total: number;
    overdue: number;
  };
  borrowers: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  detail: string;
  time: string;
  type: "loan" | "action" | "alert" | "borrower";
}

async function fetchUserRole(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

function isAdminRole(role: string | null): boolean {
  return role === "admin" || role === "moderator";
}

export function useDashboardStats() {
  const { user } = useAuth();
  const hideDemo = useHideDemoData();

  return useQuery({
    queryKey: ["dashboard", "stats", user?.id, hideDemo],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) throw new Error("User not authenticated");

      const role = await fetchUserRole(user.id);
      const scopeToUser = !isAdminRole(role);

      const now = new Date();

      let actionQuery = supabase
        .from("action_items")
        .select("id, status, due_date, assigned_to_user_id")
        .in("status", ["open", "in_progress"]);
      if (scopeToUser) actionQuery = actionQuery.eq("assigned_to_user_id", user.id);

      let borrowerQuery = supabase
        .from("borrowers")
        .select("id", { count: "exact", head: true });
      if (hideDemo) {
        borrowerQuery = borrowerQuery.not("data_source", "in", demoLoanSourcesInList());
      }

      let encompassLoansQuery = supabase
        .from("loans")
        .select("id, loan_officer_id")
        .eq("data_source", "encompass");
      if (scopeToUser) encompassLoansQuery = encompassLoansQuery.eq("loan_officer_id", user.id);

      const integrationPromise = supabase
        .from("integration_settings")
        .select("provider_name, is_active, config")
        .in("provider_name", ["hubspot", "encompass"]);

      const [actionRes, borrowerRes, integrationRes, encompassLoansRes] = await Promise.all([
        actionQuery,
        borrowerQuery,
        integrationPromise,
        encompassLoansQuery,
      ]);

      const actionItems = (actionRes.data ?? []) as Array<{ id: string; status: string; due_date: string | null }>;

      const overdueActions = actionItems.filter(
        (a) => a.due_date && new Date(a.due_date) < now,
      ).length;

      const integrationRows = (integrationRes.data ?? []) as Array<{
        provider_name: string;
        is_active: boolean;
        config: Record<string, unknown> | null;
      }>;

      const hubspotCfg = integrationRows.find((r) => r.provider_name === "hubspot")?.config ?? {};
      const encompassCfg = integrationRows.find((r) => r.provider_name === "encompass")?.config ?? {};

      const parseCount = (value: unknown) => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
          const parsed = Number.parseInt(value, 10);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      return {
        crm: {
          hubspotContacts: parseCount(hubspotCfg.hubspot_contacts_count),
          hubspotDeals: parseCount(hubspotCfg.hubspot_deals_count),
          encompassRecords: (encompassLoansRes.data ?? []).length || parseCount(encompassCfg.last_sync_item_count),
          hubspotLastSyncAt: typeof hubspotCfg.last_sync_at === "string" ? hubspotCfg.last_sync_at : null,
          encompassLastSyncAt: typeof encompassCfg.last_sync_at === "string" ? encompassCfg.last_sync_at : null,
        },
        actionItems: { total: actionItems.length, overdue: overdueActions },
        borrowers: borrowerRes.count ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 3,
  });
}

export function useRecentActivity() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard", "activity", user?.id],
    queryFn: async (): Promise<RecentActivity[]> => {
      if (!user) throw new Error("User not authenticated");

      const role = await fetchUserRole(user.id);
      const scopeToUser = !isAdminRole(role);

      const activities: RecentActivity[] = [];

      try {
        let loansQ = supabase
          .from("loans")
          .select("id, loan_number, status, updated_at, loan_officer_id")
          .order("updated_at", { ascending: false })
          .limit(6);
        if (scopeToUser) loansQ = loansQ.eq("loan_officer_id", user.id);

        const { data: recentLoans } = await loansQ;

        if (recentLoans) {
          activities.push(
            ...recentLoans.map((loan: any) => ({
              id: `loan-${loan.id}`,
              action: `Loan ${loan.status}`,
              detail: loan.loan_number ?? loan.id.slice(0, 8),
              time: loan.updated_at,
              type: "loan" as const,
            })),
          );
        }
      } catch {
        /* table may not exist */
      }

      try {
        let actionsQ = supabase
          .from("action_items")
          .select("id, title, status, created_at, assigned_to_user_id")
          .order("created_at", { ascending: false })
          .limit(4);
        if (scopeToUser) actionsQ = actionsQ.eq("assigned_to_user_id", user.id);

        const { data: recentActions } = await actionsQ;

        if (recentActions) {
          activities.push(
            ...recentActions.map((item: any) => ({
              id: `action-${item.id}`,
              action: item.status === "completed" ? "Action completed" : "Action created",
              detail: item.title ?? "Untitled",
              time: item.created_at,
              type: "action" as const,
            })),
          );
        }
      } catch {
        /* table may not exist */
      }

      try {
        const { data: recentBorrowers } = await supabase
          .from("borrowers")
          .select("id, first_name, last_name, created_at")
          .order("created_at", { ascending: false })
          .limit(4);

        if (recentBorrowers) {
          activities.push(
            ...recentBorrowers.map((b: any) => ({
              id: `borrower-${b.id}`,
              action: "New borrower",
              detail: [b.first_name, b.last_name].filter(Boolean).join(" ") || "Unknown",
              time: b.created_at,
              type: "borrower" as const,
            })),
          );
        }
      } catch {
        /* table may not exist */
      }

      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return activities.slice(0, 12);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });
}

export function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}
