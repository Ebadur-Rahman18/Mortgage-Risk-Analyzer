import { useState } from "react";
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, Role, RoleFormData } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Shield, Plus, Edit, Trash2, Loader2, Check } from "lucide-react";
import {
  AVAILABLE_PERMISSIONS,
  groupPermissionsByResource,
  permissionKey,
} from "@/lib/permissions";

export default function RoleManagement() {
  const { data: roles, isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: "",
    description: "",
    permissions: [],
  });

  const openCreateDialog = () => {
    setEditingRole(null);
    setFormData({
      name: "",
      description: "",
      permissions: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      return;
    }

    try {
      if (editingRole) {
        await updateRole.mutateAsync({ id: editingRole.id, data: formData });
      } else {
        await createRole.mutateAsync(formData);
      }
      setDialogOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const openDeleteDialog = (roleId: string) => {
    setDeletingRoleId(roleId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingRoleId) return;

    try {
      await deleteRole.mutateAsync(deletingRoleId);
      setDeleteDialogOpen(false);
      setDeletingRoleId(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const groupedPermissions = groupPermissionsByResource();
  const isProcessing = createRole.isPending || updateRole.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Manage user roles and their associated permissions
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Available Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{AVAILABLE_PERMISSIONS.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(groupedPermissions).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
          <CardDescription>View and manage user roles</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!roles || roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No roles found. Create your first role to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{role.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {role.description || "No description"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {role.name === "admin" ? "Full Access" : "Standard"}
                          </Badge>
                          {role.name !== "admin" && (
                            <span className="text-sm text-muted-foreground">Managed via RLS</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(role.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update the role name, description, and permissions"
                : "Create a new role with custom permissions"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Manager, Editor, Viewer"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this role can do"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-4">
              <Label>Permissions</Label>
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([resource, permissions]) => (
                  <Card key={resource}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium capitalize">
                        {resource}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {permissions.map((perm) => {
                        const key = permissionKey(perm.resource, perm.action);
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between space-x-2"
                          >
                            <Label
                              htmlFor={key}
                              className="flex-1 cursor-pointer text-sm font-normal"
                            >
                              {perm.label}
                            </Label>
                            <Switch
                              id={key}
                              checked={formData.permissions.includes(key)}
                              onCheckedChange={() => togglePermission(key)}
                              disabled={isProcessing}
                            />
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {editingRole ? "Update Role" : "Create Role"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role? Users with this role will lose their permissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteRole.isPending}>
              {deleteRole.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
