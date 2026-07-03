/**
 * Multi-channel notifications: in-app and SendGrid email.
 * Authenticated users may only target themselves unless they are admins.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  dispatchNotification,
  type DispatchNotificationInput,
  type NotifyChannel,
} from '../_shared/dispatch-notification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function isAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role === 'admin';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
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

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uid = userData.user.id;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const user_id = typeof body.user_id === 'string' ? body.user_id : '';
    const title = typeof body.title === 'string' ? body.title : '';
    const message = typeof body.message === 'string' ? body.message : '';
    const typeRaw = typeof body.type === 'string' ? body.type : 'info';
    const link = typeof body.link === 'string' ? body.link : null;
    const metadata =
      body.metadata && typeof body.metadata === 'object' && body.metadata !== null
        ? (body.metadata as Record<string, unknown>)
        : {};
    const email_to = typeof body.email_to === 'string' ? body.email_to : null;
    const dedupe_key = typeof body.dedupe_key === 'string' ? body.dedupe_key : null;

    const chRaw = body.channels;
    const channels: NotifyChannel[] = Array.isArray(chRaw)
      ? (chRaw.filter((c) => c === 'in_app' || c === 'email') as NotifyChannel[])
      : (['in_app'] as NotifyChannel[]);

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: 'user_id, title, and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = await isAdmin(userClient, uid);
    if (user_id !== uid && !admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: can only notify yourself unless admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const type =
      typeRaw === 'success' || typeRaw === 'warning' || typeRaw === 'error' ? typeRaw : 'info';

    const service = createClient(supabaseUrl, serviceKey);
    const input: DispatchNotificationInput = {
      user_id,
      title,
      message,
      type,
      link,
      metadata,
      channels: channels.length ? channels : ['in_app'],
      email_to,
      dedupe_key,
    };

    const result = await dispatchNotification(service, input);

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
