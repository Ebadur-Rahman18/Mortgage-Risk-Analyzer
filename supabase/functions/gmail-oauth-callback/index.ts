/**
 * Exchanges OAuth code for Gmail tokens and stores them (service role).
 * POST { code: string, redirect_uri: string }
 *
 * Single-file bundle for Supabase Dashboard deploy (no sibling imports).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

async function exchangeCodeForTokens(params: {
  code: string;
  redirect_uri: string;
  client_id: string;
  client_secret: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirect_uri,
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
    throw new Error(`Token exchange failed: ${res.status} ${t}`);
  }
  return res.json();
}

async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { email?: string };
  return j.email ?? null;
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

  let code = '';
  let redirect_uri = '';
  try {
    const body = (await req.json()) as { code?: string; redirect_uri?: string };
    code = (body.code ?? '').trim();
    redirect_uri = (body.redirect_uri ?? '').trim();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!code || !redirect_uri) {
    return new Response(JSON.stringify({ error: 'code and redirect_uri are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      redirect_uri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    if (!tokens.refresh_token) {
      return new Response(
        JSON.stringify({
          error:
            'No refresh_token returned. Revoke app access in Google Account settings and try again, or use prompt=consent.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const scopeList = (tokens.scope ?? GMAIL_READONLY_SCOPE).split(/[,\s]+/).filter(Boolean);

    const email =
      (await fetchGoogleUserEmail(tokens.access_token)) ?? userData.user.email ?? 'unknown@unknown';

    const service = createClient(supabaseUrl, serviceKey);

    const { error: tokErr } = await service.from('gmail_oauth_tokens').upsert(
      {
        user_id: userId,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        token_expires_at: expiresAt,
        scopes: scopeList,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (tokErr) {
      console.error('gmail_oauth_tokens upsert', tokErr);
      return new Response(JSON.stringify({ error: 'Failed to save tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: connErr } = await service.from('gmail_connections').upsert(
      {
        user_id: userId,
        email_address: email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (connErr) {
      console.error('gmail_connections upsert', connErr);
      return new Response(JSON.stringify({ error: 'Failed to save connection' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, email_address: email }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('gmail-oauth-callback', e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? 'OAuth failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
