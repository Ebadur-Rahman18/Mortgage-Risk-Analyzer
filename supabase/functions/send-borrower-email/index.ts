/**
 * send-borrower-email — Sends an approved borrower communication via SendGrid,
 * updates the row to "sent", and notifies the loan officer in-app.
 *
 * All shared helpers are inlined so the function is self-contained for Supabase
 * Cloud Dashboard deployment (the _shared/ folder isn't available there).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Inlined: resolveSendGrid (from _shared/notify-credentials.ts) ──────────
interface SendGridResolved {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  source: 'env' | 'database' | 'merged';
}

async function resolveSendGrid(
  supabase: SupabaseClient,
): Promise<{ ok: true; creds: SendGridResolved } | { ok: false; error: string }> {
  const envKey = Deno.env.get('SENDGRID_API_KEY')?.trim() || '';
  const envFrom = Deno.env.get('SENDGRID_FROM_EMAIL')?.trim() || '';
  const envName = Deno.env.get('SENDGRID_FROM_NAME')?.trim() || 'Control Tower';

  const { data: row } = await supabase
    .from('integration_settings')
    .select('api_key, is_active, config')
    .eq('provider_name', 'sendgrid')
    .maybeSingle();

  const cfg = (row?.config ?? {}) as Record<string, unknown>;
  const dbKey = typeof row?.api_key === 'string' ? row.api_key.trim() : '';
  const dbFrom = typeof cfg.from_email === 'string' ? cfg.from_email.trim() : '';
  const dbName = typeof cfg.from_name === 'string' ? cfg.from_name.trim() : 'Control Tower';

  const apiKey = envKey || (row?.is_active !== false ? dbKey : '');
  const fromEmail = envFrom || dbFrom;
  const fromName = envName || dbName;

  if (!apiKey) return { ok: false, error: 'SendGrid not configured' };
  if (!fromEmail) return { ok: false, error: 'SendGrid from_email missing (set in integration config or SENDGRID_FROM_EMAIL)' };

  let source: SendGridResolved['source'] = 'merged';
  if (envKey && !row?.api_key) source = 'env';
  else if (!envKey && dbKey) source = 'database';

  return { ok: true, creds: { apiKey, fromEmail, fromName, source } };
}

// ─── Inlined: dispatchNotification (from _shared/dispatch-notification.ts) ───
type NotifyChannel = 'in_app' | 'email';

interface DispatchNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string | null;
  metadata?: Record<string, unknown>;
  channels: NotifyChannel[];
  email_to?: string | null;
  dedupe_key?: string | null;
}

interface DispatchNotificationResult {
  in_app?: { ok: boolean; id?: string; skipped?: boolean; error?: string };
  email?: { ok: boolean; error?: string };
  delivery_status: Record<string, unknown>;
}

async function sendSendGridEmail(params: {
  apiKey: string; fromEmail: string; fromName: string; to: string; subject: string; bodyText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.fromEmail, name: params.fromName },
      subject: params.subject,
      content: [{ type: 'text/plain', value: params.bodyText }],
    }),
  });
  if (res.ok || res.status === 202) return { ok: true };
  const errText = await res.text();
  return { ok: false, error: `SendGrid ${res.status}: ${errText.slice(0, 200)}` };
}

async function dispatchNotification(
  supabase: SupabaseClient,
  input: DispatchNotificationInput,
): Promise<DispatchNotificationResult> {
  const type = input.type ?? 'info';
  const channels = input.channels.length ? input.channels : (['in_app'] as NotifyChannel[]);
  const metadata = input.metadata ?? {};
  const result: DispatchNotificationResult = { delivery_status: {} };

  if (channels.includes('in_app')) {
    const row = {
      user_id: input.user_id, title: input.title, message: input.message, type,
      link: input.link ?? null, metadata: metadata as Record<string, unknown>,
      dedupe_key: input.dedupe_key ?? null, is_read: false,
    };
    const { data: inserted, error } = await supabase.from('notifications').insert(row).select('id').maybeSingle();
    if (error) {
      const msg = error.message || String(error);
      const isDup = (error as { code?: string }).code === '23505' || msg.includes('duplicate');
      if (isDup && input.dedupe_key) {
        result.in_app = { ok: true, skipped: true };
        result.delivery_status.in_app = 'skipped_duplicate';
      } else {
        result.in_app = { ok: false, error: msg };
        result.delivery_status.in_app = 'error';
        result.delivery_status.in_app_error = msg;
      }
    } else {
      result.in_app = { ok: true, id: inserted?.id as string | undefined };
      result.delivery_status.in_app = 'sent';
    }
  }

  let emailTo = input.email_to?.trim() || '';
  if (channels.includes('email')) {
    if (!emailTo) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', input.user_id).maybeSingle();
      emailTo = (profile?.email as string | undefined)?.trim() || '';
    }
    const sg = await resolveSendGrid(supabase);
    if (!sg.ok) {
      result.email = { ok: false, error: sg.error };
      result.delivery_status.email = 'skipped';
      result.delivery_status.email_error = sg.error;
    } else if (!emailTo) {
      result.email = { ok: false, error: 'No email for user' };
      result.delivery_status.email = 'skipped';
      result.delivery_status.email_error = 'no_email';
    } else {
      const body = `${input.message}\n\n${input.link ? `Open: ${input.link}` : ''}`.trim();
      const send = await sendSendGridEmail({
        apiKey: sg.creds.apiKey, fromEmail: sg.creds.fromEmail, fromName: sg.creds.fromName,
        to: emailTo, subject: input.title, bodyText: body,
      });
      if (send.ok) { result.email = { ok: true }; result.delivery_status.email = 'sent'; }
      else { result.email = { ok: false, error: send.error }; result.delivery_status.email = 'error'; result.delivery_status.email_error = send.error; }
    }
  }

  if (result.in_app?.id) {
    await supabase.from('notifications').update({ delivery_status: result.delivery_status as Record<string, unknown> }).eq('id', result.in_app.id);
  }
  return result;
}

// ─── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: 'Missing Supabase configuration' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResp({ error: 'Unauthorized' }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResp({ error: 'Invalid session' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      communication_id?: string;
    };

    if (!body.communication_id) {
      return jsonResp({ error: 'communication_id is required' }, 400);
    }

    const service = createClient(supabaseUrl, serviceKey);

    const { data: comm, error: commErr } = await service
      .from('borrower_communications')
      .select('id, status, loan_id, draft_content, doc_type, channel, created_by_user_id')
      .eq('id', body.communication_id)
      .maybeSingle();

    if (commErr || !comm) {
      return jsonResp({ error: 'Communication not found' }, 404);
    }

    if (comm.status !== 'approved') {
      return jsonResp(
        { error: `Only approved drafts can be sent. Current status: ${comm.status}` },
        400,
      );
    }

    const { data: loan } = await service
      .from('loans')
      .select('loan_number, borrower_id, loan_officer_id')
      .eq('id', comm.loan_id)
      .maybeSingle();

    if (!loan?.borrower_id) {
      return jsonResp({ error: 'Loan has no linked borrower — cannot determine recipient email.' }, 400);
    }

    const { data: borrower } = await service
      .from('borrowers')
      .select('email, first_name, last_name')
      .eq('id', loan.borrower_id)
      .maybeSingle();

    const recipientEmail = borrower?.email?.trim();
    if (!recipientEmail) {
      return jsonResp({ error: 'Borrower has no email address on file.' }, 400);
    }

    const sg = await resolveSendGrid(service);
    if (!sg.ok) {
      return jsonResp({ error: `SendGrid not configured: ${sg.error}` }, 400);
    }

    const subjectMap: Record<string, string> = {
      status_update: 'Loan Status Update',
      condition_request: 'Action Required — Document Request',
      closing_notification: 'Closing Update',
      rate_lock_reminder: 'Rate Lock Reminder',
      realtor_update: 'Loan Update for Your Client',
    };
    const subject = `${subjectMap[comm.doc_type] ?? 'Loan Communication'} — ${loan.loan_number ?? ''}`.trim();

    const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sg.creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipientEmail }] }],
        from: { email: sg.creds.fromEmail, name: sg.creds.fromName },
        subject,
        content: [{ type: 'text/plain', value: comm.draft_content }],
      }),
    });

    if (!sgRes.ok && sgRes.status !== 202) {
      const errText = await sgRes.text();
      console.error('SendGrid error:', errText);
      return jsonResp({ error: `SendGrid delivery failed (${sgRes.status})` }, 502);
    }

    const now = new Date().toISOString();
    await service
      .from('borrower_communications')
      .update({ status: 'sent', sent_at: now })
      .eq('id', comm.id);

    const loanOfficerId = loan.loan_officer_id as string | null;
    if (loanOfficerId) {
      try {
        const borrowerName = [borrower?.first_name, borrower?.last_name].filter(Boolean).join(' ') || recipientEmail;
        await dispatchNotification(service, {
          user_id: loanOfficerId,
          title: 'Borrower email sent',
          message: `A ${comm.doc_type.replace(/_/g, ' ')} email was sent to ${borrowerName} for loan ${loan.loan_number ?? '(unknown)'}.`,
          type: 'success',
          link: `/loans/${comm.loan_id}`,
          metadata: {
            event_type: 'borrower_email_sent',
            communication_id: comm.id,
            borrower_email: recipientEmail,
          },
          channels: ['in_app'],
          dedupe_key: `email_sent:${comm.id}`,
        });
      } catch (e) {
        console.error('Notification dispatch error:', e);
      }
    }

    return jsonResp({
      ok: true,
      communication_id: comm.id,
      sent_to: recipientEmail,
      sent_at: now,
    });
  } catch (err) {
    console.error(err);
    return jsonResp({ error: 'Internal server error' }, 500);
  }
});
