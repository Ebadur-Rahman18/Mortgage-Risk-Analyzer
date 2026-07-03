import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  FileText,
  Eye,
  Clock,
  FolderTree,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

function estimateReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / 200));
}

async function fetchKnowledgeAnalytics() {
  const [
    articleCountRes,
    viewsRes,
    sampleRes,
    categoriesCountRes,
    topRes,
    recentRes,
  ] = await Promise.all([
    supabase.from("knowledge_entries").select("*", { count: "exact", head: true }),
    supabase.from("knowledge_entries").select("view_count"),
    supabase.from("knowledge_entries").select("content").limit(100),
    supabase.from("knowledge_categories").select("*", { count: "exact", head: true }),
    supabase.from("knowledge_entries").select("id, title, view_count, slug").order("view_count", { ascending: false }).limit(10),
    supabase.from("knowledge_entries").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(10),
  ]);

  const errors = [
    articleCountRes.error,
    viewsRes.error,
    sampleRes.error,
    categoriesCountRes.error,
    topRes.error,
    recentRes.error,
  ].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to load knowledge analytics");
  }

  const totalArticles = articleCountRes.count ?? 0;
  const totalViews =
    viewsRes.data?.reduce((sum, row) => sum + (row.view_count ?? 0), 0) ?? 0;
  const categories = categoriesCountRes.count ?? 0;

  const sample = sampleRes.data ?? [];
  const avgReading =
    sample.length > 0
      ? Math.round(
          sample.reduce((sum, row) => sum + estimateReadingMinutes(row.content ?? ""), 0) /
            sample.length,
        )
      : 0;

  return {
    totalArticles,
    totalViews,
    categories,
    avgReadingMinutes: avgReading,
    avgReadingSampleSize: sample.length,
    topViewed: topRes.data ?? [],
    recentlyUpdated: recentRes.data ?? [],
  };
}

export default function KnowledgeAnalytics() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-knowledge-analytics"],
    queryFn: fetchKnowledgeAnalytics,
    staleTime: 60_000,
  });

  if (isLoading && !data) {
    return (
      <div className="container mx-auto space-y-6 py-8">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Insights and metrics from your knowledge base tables
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          {isFetching ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Refreshing
            </span>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load analytics</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Total Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalArticles ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">Published entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Total Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalViews ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">Sum of view_count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.categories ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">Knowledge categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Avg. Reading Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.totalArticles ?? 0) > 0 ? `${data?.avgReadingMinutes ?? 0} min` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Estimated from up to {data?.avgReadingSampleSize ?? 0} articles (~200 wpm)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Most Viewed Articles
            </CardTitle>
            <CardDescription>Top 10 by view count</CardDescription>
          </CardHeader>
          <CardContent>
            {!data?.topViewed?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No articles yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.topViewed.map((row) => (
                  <li key={row.id} className="flex justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                    <Link
                      to={`/knowledge/${row.id}`}
                      className="font-medium text-primary hover:underline truncate min-w-0"
                    >
                      {row.title}
                    </Link>
                    <span className="text-muted-foreground shrink-0">{row.view_count ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recently Updated
            </CardTitle>
            <CardDescription>Latest 10 modifications</CardDescription>
          </CardHeader>
          <CardContent>
            {!data?.recentlyUpdated?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No articles yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.recentlyUpdated.map((row) => (
                  <li key={row.id} className="flex justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                    <Link
                      to={`/knowledge/${row.id}`}
                      className="font-medium text-primary hover:underline truncate min-w-0"
                    >
                      {row.title}
                    </Link>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
