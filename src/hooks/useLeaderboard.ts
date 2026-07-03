import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface LeaderboardScore {
  id: string;
  user_id: string;
  period_type: "weekly" | "monthly";
  period_label: string;
  closed_count: number;
  pipeline_volume: number;
  on_time_rate: number;
  conditions_speed_avg_days: number;
  composite_score: number;
  rank: number | null;
  prev_rank: number | null;
  branch_id: string | null;
  scored_at: string;
}

export interface OfficerBadge {
  id: string;
  user_id: string;
  badge_definition_id: string;
  earned_at: string;
  loan_id: string | null;
  period_label: string | null;
  metadata: Record<string, unknown>;
  badge_definitions: BadgeDefinition;
}

export interface BadgeDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_name: string;
  criteria_type: string;
  criteria_threshold: number;
  tier: "bronze" | "silver" | "gold";
  is_active: boolean;
}

function getISOWeekLabel(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getMonthLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const leaderboardKeys = {
  all: ["leaderboard"] as const,
  scores: (periodType: string, periodLabel: string) =>
    [...leaderboardKeys.all, "scores", periodType, periodLabel] as const,
  myScore: (userId: string) =>
    [...leaderboardKeys.all, "my", userId] as const,
  badges: (userId?: string) =>
    [...leaderboardKeys.all, "badges", userId ?? "all"] as const,
  allBadgeDefs: () =>
    [...leaderboardKeys.all, "badge-defs"] as const,
};

export function useLeaderboard(
  periodType: "weekly" | "monthly",
  periodLabel?: string,
) {
  const now = new Date();
  const label =
    periodLabel ||
    (periodType === "weekly" ? getISOWeekLabel(now) : getMonthLabel(now));

  return useQuery({
    queryKey: leaderboardKeys.scores(periodType, label),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_scores")
        .select("*")
        .eq("period_type", periodType)
        .eq("period_label", label)
        .order("rank", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as LeaderboardScore[];
    },
    staleTime: 60_000,
  });
}

export function useMyScore() {
  const { user } = useAuth();
  const now = new Date();
  const weekLabel = getISOWeekLabel(now);
  const monthLabel = getMonthLabel(now);

  return useQuery({
    queryKey: leaderboardKeys.myScore(user?.id ?? ""),
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_scores")
        .select("*")
        .eq("user_id", user!.id)
        .in("period_label", [weekLabel, monthLabel])
        .order("scored_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as LeaderboardScore[];
      return {
        weekly: rows.find((r) => r.period_type === "weekly") ?? null,
        monthly: rows.find((r) => r.period_type === "monthly") ?? null,
      };
    },
    staleTime: 60_000,
  });
}

export function useOfficerBadges(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;

  return useQuery({
    queryKey: leaderboardKeys.badges(targetId),
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officer_badges")
        .select("*, badge_definitions(*)")
        .eq("user_id", targetId!)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OfficerBadge[];
    },
  });
}

export function useAllBadgeDefinitions() {
  return useQuery({
    queryKey: leaderboardKeys.allBadgeDefs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badge_definitions")
        .select("*")
        .eq("is_active", true)
        .order("criteria_type", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BadgeDefinition[];
    },
    staleTime: 300_000,
  });
}

export function useComputeLeaderboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      period_type?: "weekly" | "monthly";
      period_label?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "compute-leaderboard",
        { body: payload },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Leaderboard scores updated");
      qc.invalidateQueries({ queryKey: leaderboardKeys.all });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to compute leaderboard");
    },
  });
}

export { getISOWeekLabel, getMonthLabel };
