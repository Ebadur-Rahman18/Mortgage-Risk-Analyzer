/**
 * Resolve SendGrid credentials: env first, then integration_settings.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SendGridResolved {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  source: 'env' | 'database' | 'merged';
}

export async function resolveSendGrid(
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
  const dbFrom =
    typeof cfg.from_email === 'string' ? cfg.from_email.trim() : '';
  const dbName =
    typeof cfg.from_name === 'string' ? cfg.from_name.trim() : 'Control Tower';

  const apiKey = envKey || (row?.is_active !== false ? dbKey : '');
  const fromEmail = envFrom || dbFrom;
  const fromName = envName || dbName;

  if (!apiKey) {
    return { ok: false, error: 'SendGrid not configured' };
  }
  if (!fromEmail) {
    return { ok: false, error: 'SendGrid from_email missing (set in integration config or SENDGRID_FROM_EMAIL)' };
  }

  let source: SendGridResolved['source'] = 'merged';
  if (envKey && !row?.api_key) source = 'env';
  else if (!envKey && dbKey) source = 'database';

  return {
    ok: true,
    creds: { apiKey, fromEmail, fromName, source },
  };
}
