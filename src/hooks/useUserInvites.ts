import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";

export interface UserInvite {
  id: string;
  email: string;
  role: string;
  invited_by: string | null;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export function useUserInvites() {
  return useQuery({
    queryKey: ["user_invites"],
    queryFn: async (): Promise<UserInvite[]> => {
      const { data, error } = await supabase
        .from("user_invites")
        .select("id, email, role, invited_by, token, expires_at, used_at, created_at")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        // Table may not exist yet — return empty rather than crashing
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as UserInvite[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export interface CreateInviteResult {
  user_id: string;
  email: string;
  role: string;
  temp_password: string;
  email_status: "sent" | "skipped" | "failed";
  email_error: string | null;
}

export function useCreateUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { email: string; role: string; full_name?: string }): Promise<CreateInviteResult> => {
      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: {
          email: params.email.trim().toLowerCase(),
          role: params.role,
          full_name: params.full_name ?? "",
        },
      });
      if (error) {
        // Try to extract structured error body from FunctionsHttpError
        let msg = (error as any)?.message || "Failed to invite user";
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.code === "user_exists") {
        throw new Error(data.error || "A user with this email already exists. Please use a different email.");
      }
      if (data?.error) throw new Error(data.error);
      return data as CreateInviteResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      if (data.email_status === "sent") {
        toast.success(`Invite email sent to ${data.email}`);
      } else {
        toast.success(`User created for ${data.email}. Share the temporary password manually.`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to invite user");
    },
  });
}

export function useDeleteUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      const { error } = await supabase
        .from("user_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success("Invitation revoked");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revoke invitation");
    },
  });
}

export function useResendUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      // Extend expiry by 7 more days on "resend"
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);

      const { error } = await supabase
        .from("user_invites")
        .update({ expires_at: newExpiry.toISOString() })
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success("Invite extended — expiry reset to 7 days from now");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });
}
