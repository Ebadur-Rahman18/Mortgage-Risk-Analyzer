// @ts-nocheck — MCT Lite: legacy types misalignment, runtime works against Lite schema
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useKnowledgeEntries,
  useKnowledgeCategories,
  useDeleteKnowledgeEntry,
  type KnowledgeCategory,
} from "@/hooks/useKnowledge";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Search,
  Eye,
  FileText,
  Upload,
  Clock,
  FolderTree,
  ChevronRight,
  ChevronDown,
  BookOpen,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { truncateText } from "@/lib/utils";
import {
  canManageKnowledgeEntry,
  formatKnowledgeEntryDate,
} from "@/lib/knowledge-display-utils";
import { cn } from "@/lib/utils";

export default function Knowledge() {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const { data: categories = [] } = useKnowledgeCategories();
  const { data: allEntries = [], isLoading } = useKnowledgeEntries({});
  const { data: filteredEntries = [] } = useKnowledgeEntries({
    search,
    category_id: selectedCategory || undefined,
  });

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );

  const childrenOf = useMemo(() => {
    const map = new Map<string, KnowledgeCategory[]>();
    for (const cat of categories) {
      if (cat.parent_id) {
        const list = map.get(cat.parent_id) ?? [];
        list.push(cat);
        map.set(cat.parent_id, list);
      }
    }
    return map;
  }, [categories]);

  const countByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of allEntries) {
      if (entry.category_id) {
        map.set(entry.category_id, (map.get(entry.category_id) ?? 0) + 1);
      }
    }
    return map;
  }, [allEntries]);

  function parentCount(parentId: string) {
    let total = countByCategory.get(parentId) ?? 0;
    for (const child of childrenOf.get(parentId) ?? []) {
      total += countByCategory.get(child.id) ?? 0;
    }
    return total;
  }

  function toggleParent(id: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectCategory(id: string | null) {
    setSelectedCategory((prev) => (prev === id ? null : id));
    setSearch("");
  }

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);
  const displayEntries = search || selectedCategory ? filteredEntries : allEntries;

  const publishedEntries = allEntries.filter((e) => e.status === "published").length;

  const recentlyAdded = useMemo(
    () =>
      [...allEntries]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [allEntries],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {publishedEntries} articles across {parentCategories.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <Link to="/knowledge/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Entry
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/knowledge/upload">
              <Upload className="mr-1.5 h-4 w-4" />
              Upload
            </Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search articles, guides, documentation..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value) setSelectedCategory(null);
          }}
          className="pl-9"
        />
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-6 min-h-[500px]">
        {/* Category sidebar */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-320px)] max-h-[600px]">
                <div className="px-2 pb-3 space-y-0.5">
                  {/* All entries option */}
                  <button
                    onClick={() => selectCategory(null)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                      !selectedCategory && !search
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span>All Articles</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                      {allEntries.length}
                    </Badge>
                  </button>

                  {parentCategories.map((parent) => {
                    const children = childrenOf.get(parent.id) ?? [];
                    const isExpanded = expandedParents.has(parent.id);
                    const isSelected = selectedCategory === parent.id;
                    const pCount = parentCount(parent.id);

                    return (
                      <div key={parent.id}>
                        <div className="flex items-center">
                          {children.length > 0 && (
                            <button
                              onClick={() => toggleParent(parent.id)}
                              className="shrink-0 p-1 rounded hover:bg-muted"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              selectCategory(parent.id);
                              if (!isExpanded && children.length > 0) toggleParent(parent.id);
                            }}
                            className={cn(
                              "flex flex-1 items-center justify-between rounded-md px-2 py-2 text-sm transition-colors",
                              children.length === 0 && "ml-5",
                              isSelected
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-foreground hover:bg-muted",
                            )}
                          >
                            <span className="truncate">{parent.name}</span>
                            {pCount > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 h-5 ml-1 shrink-0">
                                {pCount}
                              </Badge>
                            )}
                          </button>
                        </div>

                        {isExpanded && children.length > 0 && (
                          <div className="ml-5 border-l border-border pl-2 space-y-0.5 mt-0.5">
                            {children.map((child) => {
                              const cCount = countByCategory.get(child.id) ?? 0;
                              const childSelected = selectedCategory === child.id;
                              return (
                                <button
                                  key={child.id}
                                  onClick={() => selectCategory(child.id)}
                                  className={cn(
                                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors",
                                    childSelected
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                  )}
                                >
                                  <span className="truncate">{child.name}</span>
                                  {cCount > 0 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-4 ml-1 shrink-0">
                                      {cCount}
                                    </Badge>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        {/* Mobile category chips */}
        <div className="lg:hidden w-full">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge
              variant={!selectedCategory ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => selectCategory(null)}
            >
              All
            </Badge>
            {parentCategories.map((cat) => (
              <Badge
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => selectCategory(cat.id)}
              >
                {cat.name} ({parentCount(cat.id)})
              </Badge>
            ))}
          </div>

          {/* Content for mobile renders inline below */}
          <KnowledgeContent
            title={
              search
                ? `Search: "${search}"`
                : selectedCategoryObj?.name ?? "All Articles"
            }
            subtitle={selectedCategoryObj?.description ?? undefined}
            entries={displayEntries}
            isLoading={isLoading}
            recentlyAdded={!search && !selectedCategory ? recentlyAdded : undefined}
            userId={user?.id}
            userRole={profile?.role}
          />
        </div>

        {/* Desktop content area */}
        <div className="hidden lg:block flex-1 min-w-0">
          <KnowledgeContent
            title={
              search
                ? `Search: "${search}"`
                : selectedCategoryObj?.name ?? "All Articles"
            }
            subtitle={selectedCategoryObj?.description ?? undefined}
            entries={displayEntries}
            isLoading={isLoading}
            recentlyAdded={!search && !selectedCategory ? recentlyAdded : undefined}
            userId={user?.id}
            userRole={profile?.role}
          />
        </div>
      </div>
    </div>
  );
}

type KnowledgeListEntry = {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  status: string | null;
  tags: string[] | null;
  view_count: number | null;
  created_at: string;
  author_id?: string | null;
  metadata?: unknown;
  category_id: string | null;
  knowledge_categories?: { name: string; slug: string } | null;
};

interface KnowledgeContentProps {
  title: string;
  subtitle?: string;
  entries: KnowledgeListEntry[];
  isLoading: boolean;
  recentlyAdded?: KnowledgeListEntry[];
  userId?: string;
  userRole?: string | null;
}

function KnowledgeEntryDeleteButton({
  entryId,
  entryTitle,
}: {
  entryId: string;
  entryTitle: string;
}) {
  const deleteEntry = useDeleteKnowledgeEntry();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${entryTitle}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete article?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{entryTitle}&quot; will be removed from the knowledge base. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              void deleteEntry.mutateAsync(entryId);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function KnowledgeContent({
  title,
  subtitle,
  entries,
  isLoading,
  recentlyAdded,
  userId,
  userRole,
}: KnowledgeContentProps) {
  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>

      {/* Recently added (only on "All Articles" view) */}
      {recentlyAdded && recentlyAdded.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Recently Added
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recentlyAdded.map((entry) => {
              const canDelete = canManageKnowledgeEntry(userId, userRole, entry);
              return (
                <Card
                  key={entry.id}
                  className="relative h-full transition-all hover:shadow-md hover:border-primary/30 group"
                >
                  {canDelete && (
                    <div className="absolute right-2 top-2 z-10">
                      <KnowledgeEntryDeleteButton entryId={entry.id} entryTitle={entry.title} />
                    </div>
                  )}
                  <Link to={`/knowledge/${entry.id}`} className="block h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="line-clamp-2 text-sm group-hover:text-primary transition-colors pr-8">
                        {entry.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {entry.knowledge_categories && (
                          <Badge variant="outline" className="text-[10px]">
                            {entry.knowledge_categories.name}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatKnowledgeEntryDate(entry)}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {truncateText(entry.summary || entry.content, 120)}
                      </p>
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Entry list */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : entries.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="mb-1 text-base font-semibold">No articles found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try a different search or category.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/knowledge/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Entry
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const canDelete = canManageKnowledgeEntry(userId, userRole, entry);
            return (
              <div
                key={entry.id}
                className="group flex items-start gap-2 rounded-lg border p-4 transition-all hover:bg-muted/40 hover:border-primary/30 hover:shadow-sm"
              >
                <Link to={`/knowledge/${entry.id}`} className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {entry.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {truncateText(entry.summary || entry.content, 180)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {entry.knowledge_categories && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {entry.knowledge_categories.name}
                        </Badge>
                      )}
                      {entry.tags && entry.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                      <span className="text-[10px] text-muted-foreground">
                        {formatKnowledgeEntryDate(entry)}
                      </span>
                      {entry.view_count != null && entry.view_count > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Eye className="h-3 w-3" /> {entry.view_count}
                        </span>
                      )}
                      {entry.content && (
                        <span className="text-[10px] text-muted-foreground">
                          {Math.ceil(entry.content.split(/\s+/).length / 200)} min read
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                </Link>
                {canDelete && (
                  <KnowledgeEntryDeleteButton entryId={entry.id} entryTitle={entry.title} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
