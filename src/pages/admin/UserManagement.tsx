import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Search, UserPlus, Edit, Trash2, Shield, Mail, Calendar, Loader2, Ban, RefreshCw, X, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { getInitials, formatDate } from "@/lib/utils";
import { useUserInvites, useCreateUserInvite, useDeleteUserInvite, useResendUserInvite } from "@/hooks/useUserInvites";
import { useRoles } from "@/hooks/useRoles";
import { normalizeRoleString } from "@/lib/agentRoles";

const APP_ROLES = [
  { value: "loan_officer" as const, label: "Loan Officer" },
  { value: "moderator" as const, label: "Manager" },
  { value: "admin" as const, label: "Admin" },
] as const;

const INVITE_ROLES = [
  { value: "loan_officer", label: "Loan Officer" },
  { value: "moderator", label: "Manager" },
  { value: "admin", label: "Admin" },
] as const;

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  branch_id: string | null;
  role: string | null;
  custom_role_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  deactivated_by: string | null;
}

export default function UserManagement() {
  const { user: currentUser, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userForReset, setUserForReset] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState("loan_officer");
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
  
  const [editRole, setEditRole] = useState("");
  const [processing, setProcessing] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  const { data: customRoles = [] } = useRoles();

  // Invite hooks
  const { data: pendingInvites = [], isLoading: invitesLoading } = useUserInvites();
  const createInvite = useCreateUserInvite();
  const deleteInvite = useDeleteUserInvite();
  const resendInvite = useResendUserInvite();

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all profiles (only columns that exist in this project's schema)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, created_at, branch_id")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role, custom_role_id")
            .eq("user_id", profile.id)
            .maybeSingle();

          return {
            ...profile,
            role: roleData?.role || null,
            custom_role_id: roleData?.custom_role_id ?? null,
            last_sign_in_at: null,
            is_active: true,
            deactivated_at: null,
            deactivated_by: null,
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    setBranchesLoading(true);
    try {
      const { data, error } = await supabase
        .from("branches" as any)
        .select("id, name")
        .order("name");
      if (error) {
        // Table may not exist in this project — silently fall back to empty list
        if ((error as any).code === "PGRST205" || (error as any).code === "42P01") {
          setBranches([]);
          return;
        }
        throw error;
      }
      setBranches((data ?? []) as Array<{ id: string; name: string }>);
    } catch (error: any) {
      console.error("Error fetching branches:", error);
      setBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setProcessing(true);
    try {
      const result = await createInvite.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
        full_name: inviteFullName,
      });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("loan_officer");
      setTempPasswordInfo({
        email: result.email,
        password: result.temp_password,
        emailSent: result.email_status === "sent",
      });
      await fetchUsers();
    } catch (error: any) {
      // Error handling is done in the mutation hook
    } finally {
      setProcessing(false);
    }
  };


  const handleUpdateUserRole = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      // Update role in user_roles
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", selectedUser.id)
        .single();

      const isAppRole = ["admin", "moderator", "user"].includes(editRole);
      const appRole = isAppRole ? (editRole as "admin" | "moderator" | "user") : "user";
      const customRoleId = isAppRole ? null : editRole;
      const selectedCustomRoleName = customRoleId
        ? customRoles.find((r) => r.id === customRoleId)?.name ?? null
        : null;

      const selectedCustomRoleNormalized = normalizeRoleString(selectedCustomRoleName);
      const requiresBranch = selectedCustomRoleNormalized === "branch_manager" || selectedCustomRoleNormalized === "loan_officer";
      const branchIdToSet = selectedBranchId ?? null;

      if (requiresBranch && !branchIdToSet) {
        toast.error("Please select a branch for this role.");
        setProcessing(false);
        return;
      }

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: appRole, custom_role_id: customRoleId })
          .eq("user_id", selectedUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert([{ user_id: selectedUser.id, role: appRole, custom_role_id: customRoleId }]);
        if (error) throw error;
      }

      // Keep branch_id in sync for branch-scoped roles.
      // This is required for branch-scoped agents and loan branching (MLO/processors).
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ branch_id: branchIdToSet })
        .eq("id", selectedUser.id);
      if (profileErr) throw profileErr;

      setEditDialogOpen(false);
      setSelectedUser(null);
      setSelectedBranchId(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast.error("Failed to update user");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      // In a real implementation, you would call an edge function to safely delete the user
      // For now, just delete the profile and role
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { data: currentUserData } = await supabase.auth.getUser();

      if (!currentUserData.user) {
        toast.error("Not authenticated");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: !currentStatus,
          deactivated_at: !currentStatus ? null : new Date().toISOString(),
          deactivated_by: !currentStatus ? null : currentUserData.user.id,
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success(`User ${!currentStatus ? "activated" : "deactivated"} successfully`);
      fetchUsers();
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      toast.error("Failed to update user status");
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditRole(user.custom_role_id || user.role || "user");
    setSelectedBranchId(user.branch_id ?? null);
    setEditDialogOpen(true);
  };

  const openResetPasswordDialog = (user: UserProfile) => {
    setUserForReset(user);
    setNewPassword("");
    setConfirmPassword("");
    setResetPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!userForReset) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setResetPasswordLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("You must be signed in to reset a password.");
        setResetPasswordLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("admin-reset-user-password", {
        body: { userId: userForReset.id, newPassword },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Password reset successfully. User can now sign in with email and password.");
      setResetPasswordDialogOpen(false);
      setUserForReset(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const getRoleDisplayName = (user: UserProfile): string => {
    if (user.custom_role_id) {
      const custom = customRoles.find((r) => r.id === user.custom_role_id);
      return custom?.name ?? user.role ?? "user";
    }
    const app = APP_ROLES.find((r) => r.value === user.role);
    return app?.label ?? user.role ?? "user";
  };

  // Hide legacy "user"-role accounts from the admin list — module not in use.
  const visibleUsers = users.filter((u) => u.role !== "user");

  const filteredUsers = visibleUsers.filter(
    (user) =>
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case "admin":
        return "destructive";
      case "moderator":
        return "default";
      default:
        return "secondary";
    }
  };

  const editRoleIsAppRole = ["admin", "moderator", "user"].includes(editRole);
  const editCustomRoleName = editRoleIsAppRole ? null : customRoles.find((r) => r.id === editRole)?.name ?? null;
  const editCustomRoleNormalized = normalizeRoleString(editCustomRoleName);
  const editRequiresBranch =
    editCustomRoleNormalized === "branch_manager" || editCustomRoleNormalized === "loan_officer";
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visibleUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {visibleUsers.filter((u) => u.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {visibleUsers.filter((u) => u.role === "admin").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvites.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Users who have been invited but haven't accepted yet</CardDescription>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Role: {invite.role} • Expires {formatDate(invite.expires_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resendInvite.mutate(invite.id)}
                        disabled={resendInvite.isPending}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInvite.mutate(invite.id)}
                        disabled={deleteInvite.isPending}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View and manage all user accounts</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className={!user.is_active ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.full_name || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {user.full_name || "Unnamed User"}
                          </span>
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {getRoleDisplayName(user)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.branch_id ? branchNameById.get(user.branch_id) ?? "Unknown branch" : "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.is_active}
                            onCheckedChange={() => handleToggleUserStatus(user.id, user.is_active)}
                            disabled={user.id === currentUser?.id}
                          />
                          <span className="text-sm text-muted-foreground">
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openResetPasswordDialog(user)}
                              title="Reset password (admin)"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUser?.id}
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

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Creates the account immediately and emails sign-in credentials. The temporary password is also shown here so you can share it manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name (optional)</Label>
              <Input
                id="full_name"
                placeholder="Jane Doe"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                disabled={processing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={processing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <SearchableSelect
                value={inviteRole}
                onChange={setInviteRole}
                disabled={processing}
                options={INVITE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen} modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedUser?.full_name || selectedUser?.email}. To edit CRUD permissions for a role, use Role Management → Edit Role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <SearchableSelect
                value={editRole}
                onChange={setEditRole}
                disabled={processing}
                placeholder="Select role"
                options={[
                  ...APP_ROLES.map((r) => ({ value: r.value, label: r.label })),
                  ...customRoles.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editBranch">
                Branch {editRequiresBranch ? "(required for Branch Manager / Loan Officer)" : "(optional)"}
              </Label>
              <SearchableSelect
                value={selectedBranchId ?? undefined}
                onChange={(v) => setSelectedBranchId(v)}
                disabled={branchesLoading || branches.length === 0 || processing}
                placeholder={branchesLoading ? "Loading branches..." : "Select branch"}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateUserRole} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Update Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog (admin only) */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {userForReset?.full_name || userForReset?.email}. They can then sign in with email and password in addition to Google. Minimum 8 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={resetPasswordLoading}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={resetPasswordLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetPasswordDialogOpen(false)}
              disabled={resetPasswordLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPasswordLoading || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}>
              {resetPasswordLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Reset password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Temp password dialog (shown after invite) */}
      <Dialog open={!!tempPasswordInfo} onOpenChange={(o) => !o && setTempPasswordInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User created</DialogTitle>
            <DialogDescription>
              {tempPasswordInfo?.emailSent
                ? `An invite email with sign-in credentials was sent to ${tempPasswordInfo?.email}.`
                : `Email delivery isn't configured yet — share these credentials with ${tempPasswordInfo?.email} manually.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <div className="text-sm"><span className="text-muted-foreground">Email:</span> <span className="font-medium">{tempPasswordInfo?.email}</span></div>
              <div className="text-sm">
                <span className="text-muted-foreground">Temporary password:</span>{" "}
                <code className="rounded bg-background px-2 py-1 border font-mono">{tempPasswordInfo?.password}</code>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Ask the user to sign in and change their password right away.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (tempPasswordInfo) navigator.clipboard.writeText(tempPasswordInfo.password);
                toast.success("Password copied");
              }}
            >
              Copy password
            </Button>
            <Button onClick={() => setTempPasswordInfo(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
