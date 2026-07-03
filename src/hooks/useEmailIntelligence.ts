// @ts-nocheck — MCT Lite: hidden module, type drift after schema changes
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";

export interface GmailConnection {
  user_id: string;
  email_address: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailMessageRow {
  id: string;
  user_id: string;
  gmail_message_id: string;
  thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  from_address: string | null;
  internal_date: string | null;
  loan_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmailAttachmentRow {
  id: string;
  message_id: string;
  gmail_attachment_id: string;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
}

export function useGmailConnection() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.emailIntelligence.connection,
    queryFn: async (): Promise<GmailConnection | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("gmail_connections")
        .select("user_id, email_address, last_sync_at, created_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as GmailConnection | null;
    },
    enabled: !!user,
  });
}

export function useEmailMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.emailIntelligence.messages({}),
    queryFn: async (): Promise<EmailMessageRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("email_messages")
        .select(
          "id, user_id, gmail_message_id, thread_id, subject, snippet, body_text, from_address, internal_date, loan_id, metadata, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .order("internal_date", { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as EmailMessageRow[];
    },
    enabled: !!user,
  });
}

export function useEmailAttachments(messageId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.emailIntelligence.attachments(messageId ?? ""),
    queryFn: async (): Promise<EmailAttachmentRow[]> => {
      if (!user || !messageId) return [];
      const { data, error } = await supabase
        .from("email_attachments")
        .select("id, message_id, gmail_attachment_id, filename, mime_type, size_bytes")
        .eq("message_id", messageId)
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as EmailAttachmentRow[];
    },
    enabled: !!user && !!messageId,
  });
}

export function useGmailOAuthStart() {
  return useMutation({
    mutationFn: async () => {
      const redirect_uri = `${window.location.origin}/email-intelligence/callback`;
      const { data, error } = await supabase.functions.invoke("gmail-oauth-start", {
        body: { redirect_uri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);
      return data as { authUrl: string };
    },
  });
}

export function useGmailOAuthCallback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, redirect_uri }: { code: string; redirect_uri: string }) => {
      const { data, error } = await supabase.functions.invoke("gmail-oauth-callback", {
        body: { code, redirect_uri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);
      return data as { success: boolean; email_address?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-intelligence"] });
    },
  });
}

export function useGmailSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (maxResults?: number) => {
      const { data, error } = await supabase.functions.invoke("gmail-sync", {
        body: maxResults ? { maxResults } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);
      return data as { success: boolean; synced: number; listed: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-intelligence"] });
    },
  });
}

export function useGmailDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gmail-disconnect", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-intelligence"] });
    },
  });
}

function decodeGmailAttachmentBase64(data: string): Uint8Array {
  const pad = data.length % 4 === 0 ? "" : "=".repeat(4 - (data.length % 4));
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function downloadGmailAttachment(params: {
  message_id: string;
  gmail_attachment_id: string;
  filename?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke("gmail-get-attachment", {
    body: {
      message_id: params.message_id,
      gmail_attachment_id: params.gmail_attachment_id,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error as string);
  const raw = data as { data: string; filename?: string | null; mime_type?: string | null };
  const bytes = decodeGmailAttachmentBase64(raw.data);
  const blob = new Blob([bytes], { type: raw.mime_type || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = raw.filename || "attachment";
  a.click();
  URL.revokeObjectURL(url);
}
