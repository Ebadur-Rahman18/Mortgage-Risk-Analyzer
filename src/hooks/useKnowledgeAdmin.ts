import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CategoryStats {
  entry_count: number;
  published_count: number;
  draft_count: number;
  total_views: number;
  last_updated: string | null;
}

interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  sort_order: number | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface CategoryWithStats extends KnowledgeCategory {
  stats?: CategoryStats;
  children?: CategoryWithStats[];
}

interface KnowledgeStats {
  totalCategories: number;
  totalEntries: number;
  publishedEntries: number;
  draftEntries: number;
  totalViews: number;
  recentlyUpdated: number;
  categoriesWithNoEntries: number;
  averageEntriesPerCategory: number;
}

type KnowledgeCategoryInsert = Partial<KnowledgeCategory>;
type KnowledgeCategoryUpdate = Partial<KnowledgeCategory>;

// Note: knowledge_categories and knowledge_entries tables need to be created
// These hooks return empty data until the tables are created

export function useCategories(includeStats = false) {
  return useQuery({
    queryKey: ['knowledge-categories', includeStats],
    queryFn: async (): Promise<KnowledgeCategory[] | CategoryWithStats[]> => {
      // Table not yet created - return empty array
      return [];
    },
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: ['knowledge-category', id],
    queryFn: async (): Promise<CategoryWithStats | null> => {
      // Table not yet created - return null
      return null;
    },
    enabled: !!id,
  });
}

export function useCategoryTree() {
  return useQuery({
    queryKey: ['knowledge-category-tree'],
    queryFn: async (): Promise<CategoryWithStats[]> => {
      // Table not yet created - return empty array
      return [];
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: KnowledgeCategoryInsert): Promise<KnowledgeCategory> => {
      toast.error("Knowledge categories require database migration");
      throw new Error("knowledge_categories table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success("Category created successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to create category:", error);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: KnowledgeCategoryUpdate }): Promise<KnowledgeCategory> => {
      toast.error("Knowledge categories require database migration");
      throw new Error("knowledge_categories table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success("Category updated successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to update category:", error);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      toast.error("Knowledge categories require database migration");
      throw new Error("knowledge_categories table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success("Category deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to delete category:", error);
    },
  });
}

export function useMergeCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }): Promise<void> => {
      toast.error("Knowledge categories require database migration");
      throw new Error("knowledge_categories table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success("Categories merged successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to merge categories:", error);
    },
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]): Promise<void> => {
      toast.error("Knowledge categories require database migration");
      throw new Error("knowledge_categories table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
    },
    onError: (error: Error) => {
      console.error("Failed to reorder categories:", error);
    },
  });
}

export function useKnowledgeStats() {
  return useQuery({
    queryKey: ['knowledge-stats'],
    queryFn: async (): Promise<KnowledgeStats> => {
      // Tables not yet created - return empty stats
      return {
        totalCategories: 0,
        totalEntries: 0,
        publishedEntries: 0,
        draftEntries: 0,
        totalViews: 0,
        recentlyUpdated: 0,
        categoriesWithNoEntries: 0,
        averageEntriesPerCategory: 0,
      };
    },
  });
}

export function useBulkUpdateEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryIds, updates }: { entryIds: string[]; updates: any }): Promise<void> => {
      toast.error("Knowledge entries require database migration");
      throw new Error("knowledge_entries table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      toast.success("Entries updated successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to update entries:", error);
    },
  });
}

export function useGenerateEmbeddings() {
  return useMutation({
    mutationFn: async (entryId: string): Promise<void> => {
      toast.error("Embeddings require database migration");
      throw new Error("embeddings table not yet created");
    },
    onSuccess: () => {
      toast.success("Embeddings generated successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to generate embeddings:", error);
    },
  });
}

// Category by slug hook
export function useCategoryBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['knowledge-category-slug', slug],
    queryFn: async (): Promise<KnowledgeCategory | null> => {
      // Table not yet created - return null
      return null;
    },
    enabled: !!slug,
  });
}
