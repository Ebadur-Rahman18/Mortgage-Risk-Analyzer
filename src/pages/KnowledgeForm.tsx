import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useKnowledgeEntry,
  useCreateKnowledgeEntry,
  useUpdateKnowledgeEntry,
  useKnowledgeCategories,
} from "@/hooks/useKnowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { suggestKnowledgeCategories } from "@/lib/knowledge-category-suggestions";

export default function KnowledgeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const { data: entry, isLoading: loadingEntry } = useKnowledgeEntry(id || "");
  const { data: categories } = useKnowledgeCategories();
  const createEntry = useCreateKnowledgeEntry();
  const updateEntry = useUpdateKnowledgeEntry();

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    category: "",
    tags: [] as string[],
  });

  useEffect(() => {
    if (!entry) return;
    setFormData({
      title: entry.title ?? "",
      content: entry.content ?? "",
      summary: entry.summary ?? "",
      category: entry.category_id ?? "",
      tags: entry.tags ?? [],
    });
  }, [entry]);

  const suggestions = suggestKnowledgeCategories(categories ?? [], {
    title: formData.title,
    content: formData.content,
    summary: formData.summary,
    tags: formData.tags,
  });
  const topSuggestion = suggestions[0];
  const suggestedCategory = categories?.find((c) => c.id === topSuggestion?.categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.content || !formData.category) {
      toast.error("Title, content, and category are required");
      return;
    }

    try {
      if (isEditing && id) {
        await updateEntry.mutateAsync({ 
          id, 
          data: {
            title: formData.title,
            content: formData.content,
            summary: formData.summary || undefined,
            category: formData.category || undefined,
            tags: formData.tags.length > 0 ? formData.tags : undefined,
          } 
        });
      } else {
        await createEntry.mutateAsync({
          title: formData.title,
          content: formData.content,
          summary: formData.summary,
          category: formData.category,
          tags: formData.tags,
        } as any);
      }
      navigate("/knowledge");
    } catch (error) {
      console.error("Submit error:", error);
    }
  };

  if (isEditing && loadingEntry) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? "Update your knowledge entry"
              : "Create a new knowledge entry with markdown support"}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/knowledge")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {!formData.category && suggestedCategory && (
          <Card className="border-dashed">
            <CardContent className="pt-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Suggested category: {suggestedCategory.name}</p>
                <p className="text-sm text-muted-foreground">{topSuggestion.reason}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({ ...formData, category: suggestedCategory.id })}
              >
                Apply Suggestion
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
            <CardDescription>
              Basic information about your entry
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter entry title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">
                Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Write your content using Markdown..."
                rows={10}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                value={formData.category}
                onChange={(value) => setFormData({ ...formData, category: value })}
                placeholder="Select a category"
                options={(categories ?? []).map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                value={formData.summary}
                onChange={(e) =>
                  setFormData({ ...formData, summary: e.target.value })
                }
                placeholder="Brief summary of the entry (optional)"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/knowledge")}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createEntry.isPending || updateEntry.isPending || !formData.category}
          >
            {createEntry.isPending || updateEntry.isPending
              ? "Saving..."
              : isEditing
              ? "Update Entry"
              : "Create Entry"}
          </Button>
        </div>
      </form>
    </div>
  );
}
