/**
 * Notify admins about new user feedback (in-app, optional email list).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dispatchNotification } from '../_shared/dispatch-notification.ts';
import { resolveSendGrid } from '../_shared/notify-credentials.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const body = (await req.json().catch(() => ({}))) as { feedback_id?: string };
    const feedback_id = body.feedback_id;
    if (!feedback_id || typeof feedback_id !== 'string') {
      return new Response(JSON.stringify({ error: 'feedback_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const service = createClient(supabaseUrl, serviceKey);

    const { data: fb, error: fbErr } = await service
      .from('feedback')
      .select('id, user_id, type, subject, message, status, created_at')
      .eq('id', feedback_id)
      .maybeSingle();

    if (fbErr || !fb) {
      return new Response(JSON.stringify({ error: 'Feedback not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (fb.user_id !== uid) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const title = `New feedback: ${fb.subject}`;
    const msg = `Type: ${fb.type}\n${fb.message.slice(0, 500)}${fb.message.length > 500 ? '…' : ''}`;
    const meta = {
      event_type: 'feedback_submitted',
      feedback_id: fb.id,
    };

    const { data: adminRows } = await service.from('user_roles').select('user_id').eq('role', 'admin');
    const adminIds = (adminRows ?? []).map((r: { user_id: string }) => r.user_id);

    const results: unknown[] = [];
    for (const adminId of adminIds) {
      const r = await dispatchNotification(service, {
        user_id: adminId,
        title,
        message: msg,
        type: 'info',
        link: '/admin/feedback',
        metadata: meta,
        channels: ['in_app'],
      });
      results.push(r);
    }

    const { data: integ } = await service
      .from('integration_settings')
      .select('config')
      .eq('provider_name', 'sendgrid')
      .maybeSingle();
    const cfg = (integ?.config ?? {}) as Record<string, unknown>;
    const adminEmails = Array.isArray(cfg.admin_emails)
      ? (cfg.admin_emails as unknown[]).filter((e): e is string => typeof e === 'string')
      : [];

    const sg = await resolveSendGrid(service);
    if (sg.ok && adminEmails.length > 0) {
      const bodyText = `${msg}\n\nOpen Admin → Feedback in Control Tower.`;
      for (const to of adminEmails) {
        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sg.creds.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: sg.creds.fromEmail, name: sg.creds.fromName },
            subject: title,
            content: [{ type: 'text/plain', value: bodyText }],
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        notified_admins: adminIds.length,
        admin_in_app: results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
