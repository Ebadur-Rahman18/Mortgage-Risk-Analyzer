import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { KnowledgeEntryFormData } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { logCrud } from "@/lib/activity-logger";

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  slug: string;
  category_id: string | null;
  tags: string[] | null;
  summary: string | null;
  status: string | null;
  view_count: number | null;
  author_id: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  sort_order: number | null;
  lifecycle_state?: "active" | "deprecated" | "archived";
  governance_owner_role?: string | null;
  review_cadence_days?: number | null;
  effective_date?: string | null;
  deprecated_at?: string | null;
  archived_at?: string | null;
  is_regulatory_critical?: boolean;
  aliases?: string[] | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useKnowledgeEntries(filters?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.knowledge.entries(filters),
    queryFn: async (): Promise<(KnowledgeEntry & { knowledge_categories?: KnowledgeCategory | null })[]> => {
      let query = supabase
        .from("knowledge_entries")
        .select(`
          *,
          knowledge_categories(*)
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%,summary.ilike.%${filters.search}%`);
      }
      if (filters?.category_id) {
        query = query.eq("category_id", filters.category_id);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.author_id) {
        query = query.eq("author_id", filters.author_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching knowledge entries:", error);
        throw error;
      }

      return data || [];
    },
  });
}

export interface DocumentExtractRow {
  id: string;
  knowledge_entry_id: string | null;
  parse_status: string;
  parse_error: string | null;
  word_count: number | null;
  page_count: number | null;
  extracted_text: string | null;
  sections: unknown;
  tables_json: unknown;
  metadata: unknown;
  file_name: string;
  parsed_at: string | null;
}

/** Published knowledge entry: server-parsed document row (RLS: author or staff). */
export function useDocumentExtractForEntry(knowledgeEntryId: string) {
  return useQuery({
    queryKey: queryKeys.knowledge.documentExtract(knowledgeEntryId),
    queryFn: async (): Promise<DocumentExtractRow | null> => {
      const { data, error } = await supabase
        .from("document_extracts")
        .select(
          "id, knowledge_entry_id, parse_status, parse_error, word_count, page_count, extracted_text, sections, tables_json, metadata, file_name, parsed_at",
        )
        .eq("knowledge_entry_id", knowledgeEntryId)
        .maybeSingle();

      if (error) {
        console.warn("document_extracts:", error.message);
        return null;
      }
      return data as DocumentExtractRow | null;
    },
    enabled: !!knowledgeEntryId,
  });
}

export function useKnowledgeEntry(id: string) {
  return useQuery({
    queryKey: queryKeys.knowledge.entry(id),
    queryFn: async (): Promise<(KnowledgeEntry & { knowledge_categories?: KnowledgeCategory | null }) | null> => {
      const { data, error } = await supabase
        .from("knowledge_entries")
        .select(`
          *,
          knowledge_categories(*)
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching knowledge entry:", error);
        throw error;
      }

      return data;
    },
    enabled: !!id,
  });
}

export function useSearchKnowledge() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (query: string): Promise<KnowledgeEntry[]> => {
      // Table not yet created - return empty array
      return [];
    },
  });
}

export function useCreateKnowledgeEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: KnowledgeEntryFormData): Promise<KnowledgeEntry> => {
      if (!user) throw new Error("User not authenticated");

      // Generate slug from title
      const slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const entryData = {
        title: data.title,
        content: data.content,
        slug: `${slug}-${Date.now()}`,
        category_id: data.category || null,
        tags: data.tags || null,
        summary: data.summary || null,
        status: "published",
        author_id: user.id,
      };

      const { data: entry, error } = await supabase
        .from("knowledge_entries")
        .insert(entryData)
        .select()
        .single();

      if (error) {
        console.error("Error creating knowledge entry:", error);
        throw error;
      }

      return entry;
    },
    onSuccess: (entry) => {
      invalidateKeys.knowledge(queryClient);
      logCrud("create", "knowledge", entry.id, { title: entry.title });
      toast({
        title: "Success",
        description: "Knowledge entry created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create knowledge entry",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateKnowledgeEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<KnowledgeEntryFormData> }): Promise<KnowledgeEntry> => {
      const updateData: any = {};
      
      if (data.title !== undefined) updateData.title = data.title;
      if (data.content !== undefined) updateData.content = data.content;
      if (data.summary !== undefined) updateData.summary = data.summary || null;
      if (data.category !== undefined) updateData.category_id = data.category || null;
      if (data.tags !== undefined) updateData.tags = data.tags || null;

      const { data: entry, error } = await supabase
        .from("knowledge_entries")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating knowledge entry:", error);
        throw error;
      }

      return entry;
    },
    onSuccess: (entry) => {
      invalidateKeys.knowledge(queryClient);
      logCrud("update", "knowledge", entry.id, { title: entry.title });
      toast({
        title: "Success",
        description: "Knowledge entry updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update knowledge entry",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteKnowledgeEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("knowledge_entries")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting knowledge entry:", error);
        throw error;
      }
    },
    onSuccess: (_data, id) => {
      invalidateKeys.knowledge(queryClient);
      logCrud("delete", "knowledge", id);
      toast({
        title: "Success",
        description: "Knowledge entry deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete knowledge entry",
        variant: "destructive",
      });
    },
  });
}

// Categories hooks
export function useKnowledgeCategories(filters?: {
  includeDeprecated?: boolean;
  includeArchived?: boolean;
}) {
  return useQuery({
    queryKey: [...queryKeys.knowledge.categories, filters],
    queryFn: async (): Promise<KnowledgeCategory[]> => {
      let query = supabase
        .from("knowledge_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!filters?.includeDeprecated) {
        query = query.neq("lifecycle_state", "deprecated");
      }
      if (!filters?.includeArchived) {
        query = query.neq("lifecycle_state", "archived");
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching knowledge categories:", error);
        throw error;
      }

      return data || [];
    },
  });
}

function slugifyCategoryName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "category";
}

export function useCreateKnowledgeCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Partial<KnowledgeCategory>): Promise<KnowledgeCategory> => {
      const name = data.name?.trim();
      if (!name) {
        throw new Error("Category name is required");
      }
      const slug = (data.slug?.trim() || slugifyCategoryName(name)).slice(0, 200);
      const { data: row, error } = await supabase
        .from("knowledge_categories")
        .insert({
          name,
          slug,
          description: data.description ?? null,
          icon: data.icon ?? null,
          color: data.color ?? null,
          parent_id: data.parent_id ?? null,
          sort_order: data.sort_order ?? 0,
          lifecycle_state: data.lifecycle_state ?? "active",
          governance_owner_role: data.governance_owner_role ?? null,
          review_cadence_days: data.review_cadence_days ?? null,
          effective_date: data.effective_date ?? null,
          is_regulatory_critical: data.is_regulatory_critical ?? false,
          aliases: data.aliases ?? [],
          metadata: data.metadata ?? {},
        })
        .select()
        .single();
      if (error) throw error;
      return row as KnowledgeCategory;
    },
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.categories });
      logCrud("create", "knowledge", category.id, { type: "category", name: category.name });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateKnowledgeCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<KnowledgeCategory>;
    }): Promise<KnowledgeCategory> => {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (data.name !== undefined) patch.name = data.name.trim();
      if (data.slug !== undefined) patch.slug = data.slug.trim().slice(0, 200);
      if (data.description !== undefined) patch.description = data.description;
      if (data.icon !== undefined) patch.icon = data.icon;
      if (data.color !== undefined) patch.color = data.color;
      if (data.parent_id !== undefined) patch.parent_id = data.parent_id;
      if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
      if (data.lifecycle_state !== undefined) patch.lifecycle_state = data.lifecycle_state;
      if (data.governance_owner_role !== undefined)
        patch.governance_owner_role = data.governance_owner_role;
      if (data.review_cadence_days !== undefined)
        patch.review_cadence_days = data.review_cadence_days;
      if (data.effective_date !== undefined) patch.effective_date = data.effective_date;
      if (data.is_regulatory_critical !== undefined)
        patch.is_regulatory_critical = data.is_regulatory_critical;
      if (data.aliases !== undefined) patch.aliases = data.aliases;
      if (data.deprecated_at !== undefined) patch.deprecated_at = data.deprecated_at;
      if (data.archived_at !== undefined) patch.archived_at = data.archived_at;
      if (data.metadata !== undefined) patch.metadata = data.metadata;

      const { data: row, error } = await supabase
        .from("knowledge_categories")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row as KnowledgeCategory;
    },
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.categories });
      logCrud("update", "knowledge", category.id, { type: "category", name: category.name });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteKnowledgeCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { count, error: countError } = await supabase
        .from("knowledge_entries")
        .select("*", { count: "exact", head: true })
        .eq("category_id", id);
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error(
          "This category has knowledge articles. Reassign or remove them before deleting.",
        );
      }
      const { error } = await supabase.from("knowledge_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.categories });
      logCrud("delete", "knowledge", id, { type: "category" });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });
}

export function useKnowledgeCategoryBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.knowledge.categories, "slug", slug],
    queryFn: async (): Promise<KnowledgeCategory | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("knowledge_categories")
        .select("*")
        .eq("slug", slug)
        .neq("lifecycle_state", "archived")
        .maybeSingle();

      if (error) throw error;
      return (data as KnowledgeCategory | null) ?? null;
    },
    enabled: !!slug,
  });
}

export function useReassignKnowledgeCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      sourceCategoryId,
      targetCategoryId,
      archiveSource,
    }: {
      sourceCategoryId: string;
      targetCategoryId: string;
      archiveSource?: boolean;
    }): Promise<void> => {
      if (sourceCategoryId === targetCategoryId) {
        throw new Error("Source and target categories must be different");
      }

      const { error: updateEntriesError } = await supabase
        .from("knowledge_entries")
        .update({ category_id: targetCategoryId })
        .eq("category_id", sourceCategoryId);
      if (updateEntriesError) throw updateEntriesError;

      if (archiveSource) {
        const { error: archiveError } = await supabase
          .from("knowledge_categories")
          .update({
            lifecycle_state: "archived",
            archived_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sourceCategoryId);
        if (archiveError) throw archiveError;
      }
    },
    onSuccess: (_data, variables) => {
      invalidateKeys.knowledge(queryClient);
      logCrud("update", "knowledge", variables.sourceCategoryId, {
        type: "category-reassignment",
        targetCategoryId: variables.targetCategoryId,
        archivedSource: Boolean(variables.archiveSource),
      });
      toast({
        title: "Success",
        description: "Category reassignment completed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reassign category",
        variant: "destructive",
      });
    },
  });
}

export interface KnowledgeCategoryHealthMetrics {
  totalCategories: number;
  uncategorizedEntries: number;
  staleCategories: number;
  deprecatedInUse: number;
  perCategoryCount: Record<string, number>;
}

export function useKnowledgeCategoryHealth() {
  return useQuery({
    queryKey: [...queryKeys.knowledge.categories, "health"],
    queryFn: async (): Promise<KnowledgeCategoryHealthMetrics> => {
      const [{ data: categories, error: categoriesError }, { data: entries, error: entriesError }] =
        await Promise.all([
          supabase.from("knowledge_categories").select("id,lifecycle_state"),
          supabase.from("knowledge_entries").select("id,category_id"),
        ]);

      if (categoriesError) throw categoriesError;
      if (entriesError) throw entriesError;

      const counts: Record<string, number> = {};
      let uncategorizedEntries = 0;

      for (const entry of entries || []) {
        if (!entry.category_id) {
          uncategorizedEntries += 1;
          continue;
        }
        counts[entry.category_id] = (counts[entry.category_id] ?? 0) + 1;
      }

      const staleCategories = (categories || []).filter((c) => !counts[c.id]).length;
      const deprecatedInUse = (categories || []).filter(
        (c) => c.lifecycle_state === "deprecated" && (counts[c.id] ?? 0) > 0,
      ).length;

      return {
        totalCategories: (categories || []).length,
        uncategorizedEntries,
        staleCategories,
        deprecatedInUse,
        perCategoryCount: counts,
      };
    },
  });
}

// Related entries hook
export function useRelatedEntries(entryId: string, limit: number = 5) {
  return useQuery({
    queryKey: [...queryKeys.knowledge.entries(), 'related', entryId],
    queryFn: async (): Promise<KnowledgeEntry[]> => {
      // Fetch the current entry to get its category
      const { data: currentEntry } = await supabase
        .from("knowledge_entries")
        .select("category_id, tags")
        .eq("id", entryId)
        .single();

      if (!currentEntry) return [];

      // Find related entries by same category or overlapping tags
      let query = supabase
        .from("knowledge_entries")
        .select("*")
        .neq("id", entryId)
        .eq("status", "published")
        .limit(limit);

      if (currentEntry.category_id) {
        query = query.eq("category_id", currentEntry.category_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching related entries:", error);
        return [];
      }

      return data || [];
    },
    enabled: !!entryId,
  });
}

/** Admin: parsed document rows with optional joined entry title (requires document_extracts_select_staff policy). */
export function useDocumentExtractsAdmin(limit = 200) {
  return useQuery({
    queryKey: [...queryKeys.knowledge.all, "document-extracts", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_extracts")
        .select(`
          *,
          knowledge_entries ( id, title, slug )
        `)
        .order("parsed_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
  });
}

// View count mutation
export function useIncrementViewCount() {
  return useMutation({
    mutationFn: async (entryId: string): Promise<void> => {
      try {
        const { data: entry } = await supabase
          .from("knowledge_entries")
          .select("view_count")
          .eq("id", entryId)
          .single();

        if (entry) {
          await supabase
            .from("knowledge_entries")
            .update({ view_count: (entry.view_count || 0) + 1 })
            .eq("id", entryId);
        }
      } catch (error) {
        console.warn("Failed to increment view count:", error);
      }
    },
  });
}

// Bookmark hooks
export function useIsBookmarked(entryId: string) {
  return useQuery({
    queryKey: ['knowledge-bookmark', entryId],
    queryFn: async (): Promise<boolean> => {
      // Table not yet created
      return false;
    },
    enabled: !!entryId,
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string): Promise<void> => {
      // Table not yet created
      sonnerToast.error("Bookmarks require database migration");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bookmark'] });
    },
  });
}

export function useTriggerEmbedding() {
  return useMutation({
    mutationFn: async (entryId: string): Promise<void> => {
      // Table not yet created
      sonnerToast.error("Embeddings require database migration");
    },
  });
}
