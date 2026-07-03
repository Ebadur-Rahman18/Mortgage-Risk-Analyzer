/**
 * Returns Google OAuth URL for Gmail readonly scope.
 * POST { redirect_uri: string } — must match the URI registered in Google Cloud Console.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Inline scope — avoids cross-folder imports that Supabase deploy may omit from the bundle. */
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

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
  const clientId = Deno.env.get('GMAIL_OAUTH_CLIENT_ID');
  if (!supabaseUrl || !anonKey || !clientId) {
    return new Response(JSON.stringify({ error: 'Server missing Supabase or GMAIL_OAUTH_CLIENT_ID' }), {
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

  let redirect_uri = '';
  try {
    const body = (await req.json()) as { redirect_uri?: string };
    redirect_uri = (body.redirect_uri ?? '').trim();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!redirect_uri) {
    return new Response(JSON.stringify({ error: 'redirect_uri is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const state = btoa(JSON.stringify({ uid: userData.user.id, ts: Date.now() }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri,
    response_type: 'code',
    scope: GMAIL_READONLY_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return new Response(JSON.stringify({ authUrl, state }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
