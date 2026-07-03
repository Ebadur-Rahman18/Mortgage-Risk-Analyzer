/**
 * Core notification dispatch: in-app row and optional SendGrid email.
 * Call with Supabase service-role client only.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveSendGrid } from './notify-credentials.ts';

export type NotifyChannel = 'in_app' | 'email';

export interface DispatchNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string | null;
  metadata?: Record<string, unknown>;
  channels: NotifyChannel[];
  /** Override recipient email (defaults to profiles.email for user_id) */
  email_to?: string | null;
  dedupe_key?: string | null;
}

export interface DispatchNotificationResult {
  in_app?: { ok: boolean; id?: string; skipped?: boolean; error?: string };
  email?: { ok: boolean; error?: string };
  delivery_status: Record<string, unknown>;
}

async function sendSendGridEmail(params: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  bodyText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.fromEmail, name: params.fromName },
      subject: params.subject,
      content: [{ type: 'text/plain', value: params.bodyText }],
    }),
  });

  if (res.ok || res.status === 202) {
    return { ok: true };
  }
  const errText = await res.text();
  return { ok: false, error: `SendGrid ${res.status}: ${errText.slice(0, 200)}` };
}

export async function dispatchNotification(
  supabase: SupabaseClient,
  input: DispatchNotificationInput,
): Promise<DispatchNotificationResult> {
  const type = input.type ?? 'info';
  const channels = input.channels.length ? input.channels : (['in_app'] as NotifyChannel[]);
  const metadata = input.metadata ?? {};
  const result: DispatchNotificationResult = { delivery_status: {} };

  if (channels.includes('in_app')) {
    const row = {
      user_id: input.user_id,
      title: input.title,
      message: input.message,
      type,
      link: input.link ?? null,
      metadata: metadata as Record<string, unknown>,
      dedupe_key: input.dedupe_key ?? null,
      is_read: false,
    };

    const { data: inserted, error } = await supabase
      .from('notifications')
      .insert(row)
      .select('id')
      .maybeSingle();

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', input.user_id)
        .maybeSingle();
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
        apiKey: sg.creds.apiKey,
        fromEmail: sg.creds.fromEmail,
        fromName: sg.creds.fromName,
        to: emailTo,
        subject: input.title,
        bodyText: body,
      });
      if (send.ok) {
        result.email = { ok: true };
        result.delivery_status.email = 'sent';
      } else {
        result.email = { ok: false, error: send.error };
        result.delivery_status.email = 'error';
        result.delivery_status.email_error = send.error;
      }
    }
  }

  if (result.in_app?.id) {
    await supabase
      .from('notifications')
      .update({ delivery_status: result.delivery_status as Record<string, unknown> })
      .eq('id', result.in_app.id);
  }

  return result;
}
