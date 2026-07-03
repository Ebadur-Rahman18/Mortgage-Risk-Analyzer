/**
 * Zoom Server-to-Server OAuth token helper.
 * Credentials: Supabase secrets ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID
 * and/or integration_settings row provider_name = 'zoom' (api_key = secret, config.client_id, config.account_id).
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ZoomCredentialsResolved {
  clientId: string;
  clientSecret: string;
  accountId: string;
  source: 'env' | 'database' | 'merged';
}

export interface ZoomTokenResult {
  access_token: string;
  expires_in: number;
  expires_at_ms: number;
}

const TOKEN_URL = 'https://zoom.us/oauth/token';

function fromEnv(): Partial<ZoomCredentialsResolved> {
  const clientId = Deno.env.get('ZOOM_CLIENT_ID')?.trim() || '';
  const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET')?.trim() || '';
  const accountId = Deno.env.get('ZOOM_ACCOUNT_ID')?.trim() || '';
  if (clientId && clientSecret && accountId) {
    return { clientId, clientSecret, accountId, source: 'env' as const };
  }
  return {};
}

export async function resolveZoomCredentials(
  supabase: SupabaseClient,
): Promise<{ ok: true; creds: ZoomCredentialsResolved } | { ok: false; error: string }> {
  const envCreds = fromEnv();
  const { data: row } = await supabase
    .from('integration_settings')
    .select('api_key, config')
    .eq('provider_name', 'zoom')
    .maybeSingle();

  const config = (row?.config ?? {}) as Record<string, string>;
  const dbClientId = (config.client_id || '').trim();
  const dbAccountId = (config.account_id || '').trim();
  const dbSecret = (row?.api_key || '').trim();

  const clientId = envCreds.clientId || dbClientId;
  const clientSecret = envCreds.clientSecret || dbSecret;
  const accountId = envCreds.accountId || dbAccountId;

  if (!clientId || !clientSecret || !accountId) {
    return {
      ok: false,
      error:
        'Zoom credentials incomplete. Set ZOOM_* secrets and/or save Client ID, Client Secret, and Account ID in Admin → Integrations → Zoom.',
    };
  }

  let source: ZoomCredentialsResolved['source'] = 'merged';
  if (envCreds.clientId && envCreds.clientSecret && envCreds.accountId && !row) {
    source = 'env';
  } else if (dbClientId && dbSecret && dbAccountId && !envCreds.clientId) {
    source = 'database';
  }

  return {
    ok: true,
    creds: { clientId, clientSecret, accountId, source },
  };
}

export async function fetchZoomAccessToken(creds: ZoomCredentialsResolved): Promise<
  { ok: true; token: ZoomTokenResult } | { ok: false; error: string }
> {
  const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const body = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: creds.accountId,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Zoom token error:', res.status, text);
    return {
      ok: false,
      error: 'Zoom rejected credentials (check Client ID, Secret, Account ID and S2S app scopes).',
    };
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  if (!json.access_token) {
    return { ok: false, error: 'Zoom token response missing access_token' };
  }

  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
  const expires_at_ms = Date.now() + expiresIn * 1000 - 60_000;

  return {
    ok: true,
    token: {
      access_token: json.access_token,
      expires_in: expiresIn,
      expires_at_ms,
    },
  };
}

/** Use cached token from integration_settings.config if still valid; otherwise fetch and optionally persist. */
export async function getZoomAccessTokenForSync(
  supabase: SupabaseClient,
  settingId: string | null,
  config: Record<string, unknown>,
): Promise<{ ok: true; access_token: string } | { ok: false; error: string }> {
  const expiresAt = config.token_expires_at;
  const cached = typeof config.access_token === 'string' ? config.access_token : '';
  if (cached && typeof expiresAt === 'string') {
    const exp = new Date(expiresAt).getTime();
    if (!Number.isNaN(exp) && Date.now() < exp - 30_000) {
      return { ok: true, access_token: cached };
    }
  }

  const resolved = await resolveZoomCredentials(supabase);
  if (!resolved.ok) return resolved;

  const tokenRes = await fetchZoomAccessToken(resolved.creds);
  if (!tokenRes.ok) return tokenRes;

  const iso = new Date(tokenRes.token.expires_at_ms + 60_000).toISOString();
  if (settingId) {
    const nextConfig = {
      ...config,
      access_token: tokenRes.token.access_token,
      token_expires_at: iso,
    };
    await supabase
      .from('integration_settings')
      .update({ config: nextConfig, updated_at: new Date().toISOString() })
      .eq('id', settingId);
  }

  return { ok: true, access_token: tokenRes.token.access_token };
}
