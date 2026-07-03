/**
 * Returns base64 attachment data from Gmail for a synced message.
 * POST { message_id: uuid (email_messages.id), gmail_attachment_id: string }
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

async function getAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<{ size: number; data: string }> {
  const res = await fetch(
    `${GMAIL_API}/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`get attachment failed: ${res.status} ${t}`);
  }
  return res.json() as Promise<{ size: number; data: string }>;
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

  let messageId = '';
  let gmailAttachmentId = '';
  try {
    const body = (await req.json()) as { message_id?: string; gmail_attachment_id?: string };
    messageId = (body.message_id ?? '').trim();
    gmailAttachmentId = (body.gmail_attachment_id ?? '').trim();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!messageId || !gmailAttachmentId) {
    return new Response(JSON.stringify({ error: 'message_id and gmail_attachment_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const service = createClient(supabaseUrl, serviceKey);

  const { data: msg, error: msgErr } = await service
    .from('email_messages')
    .select('id, user_id, gmail_message_id')
    .eq('id', messageId)
    .maybeSingle();

  if (msgErr || !msg || msg.user_id !== userId) {
    return new Response(JSON.stringify({ error: 'Message not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: att, error: attErr } = await service
    .from('email_attachments')
    .select('filename, mime_type, size_bytes')
    .eq('message_id', messageId)
    .eq('gmail_attachment_id', gmailAttachmentId)
    .maybeSingle();

  if (attErr || !att) {
    return new Response(JSON.stringify({ error: 'Attachment not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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
    const refreshed = await refreshAccessToken({
      refresh_token: tokRow.refresh_token as string,
      client_id: clientId,
      client_secret: clientSecret,
    });
    accessToken = refreshed.access_token;
    await service
      .from('gmail_oauth_tokens')
      .update({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  try {
    const raw = await getAttachmentData(accessToken!, msg.gmail_message_id as string, gmailAttachmentId);
    return new Response(
      JSON.stringify({
        size: raw.size,
        data: raw.data,
        filename: att.filename,
        mime_type: att.mime_type,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('gmail-get-attachment', e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? 'Download failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
