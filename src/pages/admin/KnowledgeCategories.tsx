import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FolderTree, Loader2, Trash2, ExternalLink, PencilLine, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useKnowledgeCategories,
  useKnowledgeCategoryHealth,
  useCreateKnowledgeCategory,
  useUpdateKnowledgeCategory,
  useDeleteKnowledgeCategory,
  useReassignKnowledgeCategory,
} from "@/hooks/useKnowledge";

export default function KnowledgeCategories() {
  const { data: categories = [], isLoading, error } = useKnowledgeCategories({
    includeArchived: true,
    includeDeprecated: true,
  });
  const { data: metrics } = useKnowledgeCategoryHealth();
  const createCategory = useCreateKnowledgeCategory();
  const updateCategory = useUpdateKnowledgeCategory();
  const deleteCategory = useDeleteKnowledgeCategory();
  const reassignCategory = useReassignKnowledgeCategory();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ownerRole, setOwnerRole] = useState("");
  const [lifecycleState, setLifecycleState] = useState<"active" | "deprecated" | "archived">("active");
  const [reviewCadenceDays, setReviewCadenceDays] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [reassignTargetCategory, setReassignTargetCategory] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const reassignOptions = useMemo(
    () =>
      categories
        .filter((c) => c.id !== selectedCategoryId && c.lifecycle_state !== "archived")
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, selectedCategoryId],
  );

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setOwnerRole("");
    setLifecycleState("active");
    setReviewCadenceDays("");
    setEffectiveDate("");
  };

  const handleCreate = async () => {
    await createCategory.mutateAsync({
      name,
      slug: slug.trim() || undefined,
      description: description.trim() || null,
      governance_owner_role: ownerRole.trim() || null,
      lifecycle_state: lifecycleState,
      review_cadence_days: reviewCadenceDays ? Number(reviewCadenceDays) : null,
      effective_date: effectiveDate || null,
    });
    setCreateOpen(false);
    resetForm();
  };

  const handleOpenEdit = (categoryId: string) => {
    const current = categories.find((c) => c.id === categoryId);
    if (!current) return;
    setSelectedCategoryId(categoryId);
    setName(current.name);
    setSlug(current.slug);
    setDescription(current.description ?? "");
    setOwnerRole(current.governance_owner_role ?? "");
    setLifecycleState(current.lifecycle_state ?? "active");
    setReviewCadenceDays(current.review_cadence_days ? String(current.review_cadence_days) : "");
    setEffectiveDate(current.effective_date ?? "");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedCategoryId) return;
    await updateCategory.mutateAsync({
      id: selectedCategoryId,
      data: {
        name,
        slug: slug.trim() || undefined,
        description: description.trim() || null,
        governance_owner_role: ownerRole.trim() || null,
        lifecycle_state: lifecycleState,
        review_cadence_days: reviewCadenceDays ? Number(reviewCadenceDays) : null,
        effective_date: effectiveDate || null,
        deprecated_at: lifecycleState === "deprecated" ? new Date().toISOString() : null,
        archived_at: lifecycleState === "archived" ? new Date().toISOString() : null,
      },
    });
    setEditOpen(false);
    setSelectedCategoryId(null);
    resetForm();
  };

  const handleOpenReassign = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setReassignTargetCategory("");
    setReassignOpen(true);
  };

  const handleReassign = async () => {
    if (!selectedCategoryId || !reassignTargetCategory) return;
    await reassignCategory.mutateAsync({
      sourceCategoryId: selectedCategoryId,
      targetCategoryId: reassignTargetCategory,
      archiveSource: true,
    });
    setReassignOpen(false);
    setSelectedCategoryId(null);
    setReassignTargetCategory("");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCategory.mutateAsync(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage categories used by the shared knowledge base
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Category
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load categories"}
        </p>
      )}

      <Card>
        <CardContent className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Categories</p>
            <p className="text-2xl font-bold">{metrics?.totalCategories ?? categories.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Uncategorized Entries</p>
            <p className="text-2xl font-bold">{metrics?.uncategorizedEntries ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Stale Categories</p>
            <p className="text-2xl font-bold">{metrics?.staleCategories ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Deprecated In Use</p>
            <p className="text-2xl font-bold">{metrics?.deprecatedInUse ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center">
              <FolderTree className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
              <p className="text-muted-foreground mb-4">Create a category to organize articles.</p>
              <Button onClick={() => setCreateOpen(true)}>Create category</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.lifecycle_state === "active" ? "default" : "secondary"}>
                        {c.lifecycle_state ?? "active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-md truncate text-muted-foreground">
                      {c.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/knowledge/category/${c.slug}`} title="View on site">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c.id)}>
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenReassign(c.id)}>
                          <Shuffle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>
              Slug is used in URLs. Leave blank to generate from the name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Loan Guidelines"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug (optional)</Label>
              <Input
                id="cat-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="loan-guidelines"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description (optional)</Label>
              <Textarea
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-owner">Owner Role (optional)</Label>
              <Input
                id="cat-owner"
                value={ownerRole}
                onChange={(e) => setOwnerRole(e.target.value)}
                placeholder="e.g. Underwriter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-state">Lifecycle State</Label>
              <SearchableSelect
                value={lifecycleState}
                onChange={(value) => setLifecycleState(value as "active" | "deprecated" | "archived")}
                options={[
                  { value: "active", label: "Active" },
                  { value: "deprecated", label: "Deprecated" },
                  { value: "archived", label: "Archived" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-review">Review Cadence Days (optional)</Label>
              <Input
                id="cat-review"
                value={reviewCadenceDays}
                onChange={(e) => setReviewCadenceDays(e.target.value)}
                placeholder="e.g. 90"
                type="number"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-effective">Effective Date (optional)</Label>
              <Input
                id="cat-effective"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                type="date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || createCategory.isPending}>
              {createCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setSelectedCategoryId(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>
              Update taxonomy settings, lifecycle state, and governance metadata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-cat-name">Name</Label>
              <Input id="edit-cat-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cat-slug">Slug</Label>
              <Input id="edit-cat-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cat-desc">Description</Label>
              <Textarea
                id="edit-cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Lifecycle State</Label>
              <SearchableSelect
                value={lifecycleState}
                onChange={(value) => setLifecycleState(value as "active" | "deprecated" | "archived")}
                options={[
                  { value: "active", label: "Active" },
                  { value: "deprecated", label: "Deprecated" },
                  { value: "archived", label: "Archived" },
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim() || updateCategory.isPending}>
              {updateCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign category entries</DialogTitle>
            <DialogDescription>
              Move all entries from <strong>{selectedCategory?.name ?? "selected category"}</strong> to
              another category and archive the source category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Target Category</Label>
            <SearchableSelect
              value={reassignTargetCategory}
              onChange={setReassignTargetCategory}
              placeholder="Choose a category"
              options={reassignOptions}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReassign}
              disabled={!reassignTargetCategory || reassignCategory.isPending}
            >
              {reassignCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reassign and Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              You can only delete categories that have no knowledge articles. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleteCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
