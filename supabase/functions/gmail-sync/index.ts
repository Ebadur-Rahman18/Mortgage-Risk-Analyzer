/**
 * Fetches recent Gmail messages and upserts email_messages / email_attachments (service role).
 * POST { maxResults?: number } default 25
 *
 * Single-file bundle for Supabase Dashboard deploy (no sibling imports).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

async function refreshAccessToken(params: {
  refresh_token: string;
  client_id: string;
  client_secret: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refresh_token,
    client_id: params.client_id,
    client_secret: params.client_secret,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Refresh token failed: ${res.status} ${t}`);
  }
  return res.json();
}

function decodeBase64Url(data: string): string {
  const pad = data.length % 4 === 0 ? '' : '='.repeat(4 - (data.length % 4));
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return atob(b64);
}

function extractPlainTextFromPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload) return '';
  const mimeType = String(payload.mimeType ?? '');
  if (mimeType === 'text/plain' && payload.body && typeof payload.body === 'object') {
    const data = (payload.body as { data?: string }).data;
    if (data) {
      try {
        return decodeBase64Url(data);
      } catch {
        return '';
      }
    }
  }
  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      const sub = extractPlainTextFromPayload(p as Record<string, unknown>);
      if (sub) return sub;
    }
  }
  return '';
}

function extractFromHeader(payload: Record<string, unknown> | undefined): string | null {
  const headers = payload?.headers as { name?: string; value?: string }[] | undefined;
  if (!Array.isArray(headers)) return null;
  const from = headers.find((h) => (h.name ?? '').toLowerCase() === 'from');
  return from?.value ?? null;
}

function extractSubject(payload: Record<string, unknown> | undefined): string {
  const headers = payload?.headers as { name?: string; value?: string }[] | undefined;
  if (!Array.isArray(headers)) return '';
  const s = headers.find((h) => (h.name ?? '').toLowerCase() === 'subject');
  return s?.value ?? '';
}

interface GmailMessageListItem {
  id: string;
  threadId?: string;
}

async function listMessageIds(
  accessToken: string,
  maxResults: number,
  pageToken?: string,
): Promise<{ messages: GmailMessageListItem[]; nextPageToken?: string }> {
  const q = new URLSearchParams({ maxResults: String(maxResults) });
  if (pageToken) q.set('pageToken', pageToken);
  const res = await fetch(`${GMAIL_API}/users/me/messages?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`list messages failed: ${res.status} ${t}`);
  }
  const j = (await res.json()) as {
    messages?: GmailMessageListItem[];
    nextPageToken?: string;
  };
  return { messages: j.messages ?? [], nextPageToken: j.nextPageToken };
}

async function getMessageFull(accessToken: string, messageId: string): Promise<Record<string, unknown>> {
  const q = new URLSearchParams({ format: 'full' });
  const res = await fetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(messageId)}?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`get message failed: ${res.status} ${t}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

interface AttachmentMeta {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
}

function collectAttachments(
  payload: Record<string, unknown> | undefined,
  acc: AttachmentMeta[] = [],
): AttachmentMeta[] {
  if (!payload) return acc;
  const mimeType = String(payload.mimeType ?? '');
  const body = payload.body as { attachmentId?: string; size?: number } | undefined;
  const filenamePart = payload.filename as string | undefined;
  if (body?.attachmentId && (mimeType.startsWith('application/') || mimeType === 'message/rfc822' || filenamePart)) {
    acc.push({
      attachmentId: body.attachmentId,
      filename: filenamePart ?? null,
      mimeType: mimeType || null,
      size: body.size ?? null,
    });
  }
  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      collectAttachments(p as Record<string, unknown>, acc);
    }
  }
  return acc;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('GMAIL_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET');

  if (!supabaseUrl || !anonKey || !serviceKey || !clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Server configuration incomplete' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;

  let maxResults = 25;
  try {
    const body = (await req.json().catch(() => ({}))) as { maxResults?: number };
    if (typeof body.maxResults === 'number' && body.maxResults > 0 && body.maxResults <= 100) {
      maxResults = body.maxResults;
    }
  } catch {
    /* default */
  }

  const service = createClient(supabaseUrl, serviceKey);

  const { data: tokRow, error: tokErr } = await service
    .from('gmail_oauth_tokens')
    .select('refresh_token, access_token, token_expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (tokErr || !tokRow?.refresh_token) {
    return new Response(JSON.stringify({ error: 'Gmail not connected' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let accessToken = tokRow.access_token as string | null;
  const exp = tokRow.token_expires_at ? new Date(tokRow.token_expires_at as string).getTime() : 0;
  if (!accessToken || exp < Date.now() + 60_000) {
    try {
      const refreshed = await refreshAccessToken({
        refresh_token: tokRow.refresh_token as string,
        client_id: clientId,
        client_secret: clientSecret,
      });
      accessToken = refreshed.access_token;
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await service
        .from('gmail_oauth_tokens')
        .update({
          access_token: accessToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } catch (e) {
      console.error('refresh', e);
      return new Response(JSON.stringify({ error: 'Failed to refresh Gmail token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const { messages } = await listMessageIds(accessToken, maxResults);
    let synced = 0;

    for (const m of messages) {
      if (!m.id) continue;
      const full = await getMessageFull(accessToken, m.id);
      const payload = full.payload as Record<string, unknown> | undefined;
      const snippet = (full.snippet as string) ?? '';
      const threadId = (full.threadId as string) ?? null;
      const internalMs = full.internalDate ? parseInt(String(full.internalDate), 10) : null;
      const internalDate = internalMs ? new Date(internalMs).toISOString() : null;
      const bodyText = extractPlainTextFromPayload(payload);
      const fromAddress = extractFromHeader(payload);
      const subject = extractSubject(payload);

      const { data: inserted, error: insErr } = await service
        .from('email_messages')
        .upsert(
          {
            user_id: userId,
            gmail_message_id: m.id,
            thread_id: threadId,
            subject,
            snippet,
            body_text: bodyText,
            from_address: fromAddress,
            internal_date: internalDate,
            metadata: { labelIds: full.labelIds ?? [] },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,gmail_message_id' },
        )
        .select('id')
        .maybeSingle();

      if (insErr || !inserted?.id) {
        console.error('email_messages upsert', insErr);
        continue;
      }

      const messageRowId = inserted.id as string;

      const atts = collectAttachments(payload);
      for (const a of atts) {
        await service.from('email_attachments').upsert(
          {
            message_id: messageRowId,
            user_id: userId,
            gmail_attachment_id: a.attachmentId,
            filename: a.filename,
            mime_type: a.mimeType,
            size_bytes: a.size,
          },
          { onConflict: 'message_id,gmail_attachment_id' },
        );
      }
      synced += 1;
    }

    await service
      .from('gmail_connections')
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    return new Response(JSON.stringify({ success: true, synced, listed: messages.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('gmail-sync', e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? 'Sync failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
