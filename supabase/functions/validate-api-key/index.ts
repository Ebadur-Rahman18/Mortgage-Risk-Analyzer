/**
 * Validate API Key Edge Function
 * Tests if an API key is valid for a given provider
 */

/**
 * Self-contained bundle: Zoom S2S token fetch is inlined so dashboard/remote
 * deploy does not require a sibling `_shared/zoom-s2s.ts` in the upload.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';

interface ZoomCredsForToken {
  clientId: string;
  clientSecret: string;
  accountId: string;
  source: 'env' | 'database' | 'merged';
}

interface ZoomTokenOk {
  access_token: string;
  expires_in: number;
  expires_at_ms: number;
}

async function fetchZoomAccessToken(
  creds: ZoomCredsForToken,
): Promise<{ ok: true; token: ZoomTokenOk } | { ok: false; error: string }> {
  const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const body = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: creds.accountId,
  });

  const res = await fetch(ZOOM_TOKEN_URL, {
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

interface ValidationRequest {
  provider: string;
  apiKey?: string;
  /** Zoom S2S: Client ID (not secret) */
  zoomClientId?: string;
  /** Zoom S2S: Account ID */
  zoomAccountId?: string;
  /** LendingPad: optional overrides (merged with integration_settings row) */
  lendingpadClientId?: string;
  lendingpadAuthorizeUrl?: string;
  lendingpadTokenUrl?: string;
  /** Data feeds: optional base URL override */
  dataFeedBaseUrl?: string;
  /** Encompass password grant fields */
  encompassUsername?: string;
  encompassClientId?: string;
  encompassTokenUrl?: string;
}

interface ValidationResponse {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
  mode?: "full_validation" | "connectivity_check" | "config_check" | "stub";
  action_required?: string;
}

function jsonValidationResponse(payload: ValidationResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validate OpenAI API Key
 */
async function validateOpenAI(apiKey: string): Promise<ValidationResponse> {
  try {
    // Test the API key by making a simple request to list models
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        details: {
          modelCount: data.data?.length || 0,
        },
      };
    } else {
      const error = await response.json();
      return {
        valid: false,
        error: error.error?.message || 'Invalid API key',
      };
    }
  } catch (error) {
    console.error('OpenAI validation error:', error);
    return {
      valid: false,
      error: (error as Error).message || 'Failed to validate API key',
    };
  }
}

/**
 * Validate Anthropic API Key
 */
async function validateAnthropic(apiKey: string): Promise<ValidationResponse> {
  try {
    // Test by making a simple request to list models
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (response.ok || response.status === 400) {
      // 400 is OK because it means the API key is valid but the request might be malformed
      // We're just testing authentication, not the actual functionality
      return { valid: true };
    } else if (response.status === 401) {
      return {
        valid: false,
        error: 'Invalid API key',
      };
    } else {
      const error = await response.json();
      return {
        valid: false,
        error: error.error?.message || 'Failed to validate API key',
      };
    }
  } catch (error) {
    console.error('Anthropic validation error:', error);
    return {
      valid: false,
      error: (error as Error).message || 'Failed to validate API key',
    };
  }
}

/**
 * Validate Google AI (Gemini) API Key
 */
async function validateGoogle(apiKey: string): Promise<ValidationResponse> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );

    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        details: { modelCount: (data.models as unknown[])?.length ?? 0, message: 'Google AI API key is valid.' },
      };
    }

    const err = await response.json().catch(() => ({}));
    if (response.status === 400 || response.status === 403) {
      return {
        valid: false,
        error: (err as { error?: { message?: string } })?.error?.message || 'Invalid API key',
      };
    }
    return {
      valid: false,
      error: (err as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`,
    };
  } catch (error) {
    return { valid: false, error: (error as Error).message || 'Failed to validate API key' };
  }
}

/**
 * Validate Perplexity API Key
 */
async function validatePerplexity(apiKey: string): Promise<ValidationResponse> {
  try {
    // Minimal chat completion to verify authentication (1 token max)
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    // 200 or any model-level error (4xx with non-401 code) means the key is valid
    if (response.ok || (response.status >= 400 && response.status !== 401 && response.status !== 403)) {
      return { valid: true, details: { message: 'Perplexity API key is valid.' } };
    }
    if (response.status === 401 || response.status === 403) {
      const err = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: (err as { error?: { message?: string } })?.error?.message || 'Invalid or unauthorized API key',
      };
    }
    return { valid: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { valid: false, error: (error as Error).message || 'Failed to validate API key' };
  }
}

async function validateSendGrid(apiKey: string): Promise<ValidationResponse> {
  try {
    // Twilio/SendGrid: GET /v3/user/profile (Bearer). Mail Send–only keys may return 403 — key is still real.
    const headers = {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    };
    const res = await fetch('https://api.sendgrid.com/v3/user/profile', {
      method: 'GET',
      headers,
    });
    if (res.ok) {
      return { valid: true, details: { message: 'SendGrid API key is valid.' } };
    }
    if (res.status === 401) {
      const err = await res.json().catch(() => ({}));
      return {
        valid: false,
        error: (err as { errors?: { message?: string }[] })?.errors?.[0]?.message || 'Invalid or revoked API key',
      };
    }
    if (res.status === 403) {
      return {
        valid: true,
        details: {
          message:
            'API key is accepted. Restricted keys (e.g. Mail Send only) cannot read profile; sending still works if Mail Send is enabled.',
        },
      };
    }
    const err = await res.json().catch(() => ({}));
    return {
      valid: false,
      error: (err as { errors?: { message?: string }[] })?.errors?.[0]?.message || `HTTP ${res.status}`,
    };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

async function validateZoom(
  clientSecret: string,
  clientId: string,
  accountId: string,
  syncUserId?: string,
): Promise<ValidationResponse> {
  const tokenRes = await fetchZoomAccessToken({
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    accountId: accountId.trim(),
    source: 'env',
  });
  if (!tokenRes.ok) {
    return { valid: false, error: tokenRes.error };
  }
  const accessToken = tokenRes.token.access_token;

  // Prefer the same check as sync-zoom-files: list recordings for the sync user (matches Zoom S2S + scopes docs).
  const su = (syncUserId ?? '').trim();
  if (su) {
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const from = fromDate.toISOString().split('T')[0];
    const recUrl =
      `https://api.zoom.us/v2/users/${encodeURIComponent(su)}/recordings?from=${from}&to=${to}&page_size=1`;
    const recRes = await fetch(recUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!recRes.ok) {
      const t = await recRes.text();
      console.error('Zoom validate recordings:', recRes.status, t);
      return {
        valid: false,
        error:
          `Recording list failed (${recRes.status}). Check Sync user ID and S2S app scopes (e.g. cloud_recording:read:list_user_recordings). ${t.slice(0, 280)}`,
      };
    }
    return {
      valid: true,
      details: { message: 'Zoom Server-to-Server OAuth and sync user recordings access are valid.' },
    };
  }

  const usersRes = await fetch('https://api.zoom.us/v2/users?page_size=1', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (usersRes.ok) {
    return { valid: true, details: { message: 'Zoom Server-to-Server credentials are valid.' } };
  }
  console.error('Zoom validate users list:', usersRes.status, await usersRes.text());
  return {
    valid: true,
    details: {
      message:
        'OAuth token is valid. Add a Sync user ID (or list_users scope) to fully verify the same path as “Sync now”.',
    },
  };
}

/**
 * LendingPad: validate required OAuth fields (and URLs). Token exchange is proven by "Connect with LendingPad".
 */
async function validateLendingPad(
  supabase: SupabaseClient,
  body: {
    apiKey?: string;
    lendingpadClientId?: string;
    lendingpadAuthorizeUrl?: string;
    lendingpadTokenUrl?: string;
  },
): Promise<ValidationResponse> {
  const { data: row } = await supabase
    .from('integration_settings')
    .select('api_key, config')
    .eq('provider_name', 'lendingpad')
    .maybeSingle();

  const cfg = (row?.config ?? {}) as Record<string, string>;
  const clientSecret = (body.apiKey?.trim() || (typeof row?.api_key === 'string' ? row.api_key : '') || '').trim();
  const clientId = (body.lendingpadClientId?.trim() || cfg.client_id || '').trim();
  const authorizeUrl = (body.lendingpadAuthorizeUrl?.trim() || cfg.authorize_url || '').trim();
  const tokenUrl = (body.lendingpadTokenUrl?.trim() || cfg.token_url || '').trim();

  const missing: string[] = [];
  if (!clientId) missing.push('Client ID');
  if (!clientSecret) missing.push('Client Secret');
  if (!authorizeUrl) missing.push('Authorize URL');
  if (!tokenUrl) missing.push('Token URL');
  if (missing.length) {
    return {
      valid: false,
      error: `Missing: ${missing.join(', ')}. Save your configuration first, or enter all fields before testing.`,
    };
  }

  for (const [label, raw] of [['Authorize', authorizeUrl], ['Token', tokenUrl]] as const) {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        return { valid: false, error: `${label} URL must use http or https.` };
      }
    } catch {
      return { valid: false, error: `${label} URL is not valid.` };
    }
  }

  const hasToken = Boolean(cfg.access_token?.trim());
  return {
    valid: true,
    details: {
      message: hasToken
        ? 'OAuth access token is stored. Configuration is ready for loan sync when the sync job is enabled.'
        : 'OAuth endpoints and credentials look valid. Use "Connect with LendingPad" in the Integration Hub to authorize and store an access token.',
    },
  };
}

const DATA_FEED_PROVIDERS = [
  'hubspot',
  'encompass',
  'freddie-mac',
  'fannie-mae',
  'credit-bureau',
  'voe-provider',
  'avm-provider',
  'aus-fannie-du',
  'aus-freddie-lp',
  'investor-tpo-connector',
  'hedge-data-vendor',
  'appraisal-amc-stub',
  'flood-cert-vendor-stub',
  'title-vendor-stub',
  'homeowners-insurance-vendor-stub',
  'ron-provider-stub',
  'eclose-platform-stub',
  'adverse-action-notice-stub',
] as const;

function isDataFeedProvider(p: string): boolean {
  return (DATA_FEED_PROVIDERS as readonly string[]).includes(p);
}

/**
 * GSE / credit data feeds: require at least API key or base URL; validate URL shape.
 * Live vendor calls are contract-specific and are not performed here.
 */
async function validateDataFeed(
  supabase: SupabaseClient,
  providerName: string,
  body: { apiKey?: string; dataFeedBaseUrl?: string },
): Promise<ValidationResponse> {
  const { data: row } = await supabase
    .from('integration_settings')
    .select('api_key, config')
    .eq('provider_name', providerName)
    .maybeSingle();

  const cfg = (row?.config ?? {}) as Record<string, string>;
  const apiKey = (body.apiKey?.trim() || (typeof row?.api_key === 'string' ? row.api_key : '') || '').trim();
  const baseUrl = (body.dataFeedBaseUrl?.trim() || cfg.base_url || '').trim();

  if (!apiKey && !baseUrl) {
    return {
      valid: false,
      error:
        'Provide and save an API key and/or base URL before testing (or enter values in the form and save first).',
    };
  }

  let resolvedBase = '';
  if (baseUrl) {
    try {
      const u = new URL(baseUrl.includes('://') ? baseUrl : `https://${baseUrl}`);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        return { valid: false, error: 'Base URL must use http or https.' };
      }
      resolvedBase = u.toString().replace(/\/$/, '');
    } catch {
      return { valid: false, error: 'Base URL is not a valid URL.' };
    }
  }

  const syncPath = (cfg.sync_path || '/').trim() || '/';
  if (resolvedBase && apiKey) {
    try {
      const path = syncPath.startsWith('/') ? syncPath : `/${syncPath}`;
      const fetchUrl = `${resolvedBase}${path}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json, */*' },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) {
        return {
          valid: false,
          error: `Endpoint returned HTTP ${res.status}. Check base URL, sync path, and API key for your vendor.`,
        };
      }
      return {
        valid: true,
        details: {
          message: `Live check succeeded (HTTP ${res.status}). Use "Sync now" on the Data Feeds tab to pull data.`,
        },
      };
    } catch (e) {
      return {
        valid: false,
        error: `Could not reach ${resolvedBase}: ${(e as Error).message}`,
      };
    }
  }

  return {
    valid: true,
    details: {
      message:
        resolvedBase && !apiKey
          ? 'Base URL saved. Add an API key to run a live connectivity check, or use Sync now after saving both.'
          : 'Configuration checks passed. Save base URL + API key to enable live test and sync.',
    },
  };
}

async function validateEncompass(
  supabase: SupabaseClient,
  body: {
    apiKey?: string;
    encompassUsername?: string;
    encompassClientId?: string;
    encompassTokenUrl?: string;
  },
): Promise<ValidationResponse> {
  const { data: row } = await supabase
    .from('integration_settings')
    .select('api_key, config')
    .eq('provider_name', 'encompass')
    .maybeSingle();

  const cfg = (row?.config ?? {}) as Record<string, string>;
  const secretBundleRaw = (body.apiKey?.trim() || (typeof row?.api_key === 'string' ? row.api_key : '') || '').trim();
  let password = '';
  let clientSecret = '';
  try {
    const parsed = JSON.parse(secretBundleRaw) as { password?: string; clientSecret?: string };
    password = (parsed.password || '').trim();
    clientSecret = (parsed.clientSecret || '').trim();
  } catch {
    return {
      valid: false,
      error:
        'Encompass credentials are not in the expected secure format. Re-save configuration in Admin > Integrations.',
    };
  }

  const username = (body.encompassUsername?.trim() || cfg.encompass_username || '').trim();
  const clientId = (body.encompassClientId?.trim() || cfg.encompass_client_id || '').trim();
  const tokenUrl = (body.encompassTokenUrl?.trim() || cfg.encompass_token_url || 'https://api.elliemae.com/oauth2/v1/token').trim();

  const missing: string[] = [];
  if (!username) missing.push('username');
  if (!password) missing.push('password');
  if (!clientId) missing.push('client_id');
  if (!clientSecret) missing.push('client_secret');
  if (!tokenUrl) missing.push('token_url');
  if (missing.length) {
    return { valid: false, error: `Missing required Encompass field(s): ${missing.join(', ')}` };
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    const raw = await res.text();
    if (!res.ok) {
      // Parse Encompass error body for a user-friendly message
      let encompassError = raw.slice(0, 400);
      try {
        const errJson = JSON.parse(raw) as {
          error?: string;
          error_description?: string;
          message?: string;
          errors?: { summary?: string; details?: string }[];
        };
        const desc = errJson.error_description || errJson.message || errJson.errors?.[0]?.summary || '';
        const code = errJson.error || '';
        encompassError = [code, desc].filter(Boolean).join(' — ') || raw.slice(0, 400);
      } catch { /* keep raw */ }
      return {
        valid: false,
        error: `Encompass HTTP ${res.status}: ${encompassError}`,
      };
    }

    const json = JSON.parse(raw) as { access_token?: string; token_type?: string; expires_in?: number };
    if (!json.access_token) {
      return { valid: false, error: 'Encompass token response did not include access_token.' };
    }

    return {
      valid: true,
      details: {
        message: 'Encompass credentials validated successfully via OAuth token endpoint.',
        token_type: json.token_type || 'bearer',
        expires_in: json.expires_in ?? null,
      },
    };
  } catch (e) {
    return { valid: false, error: `Failed to call Encompass token endpoint: ${(e as Error).message}` };
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      provider,
      apiKey,
      zoomClientId,
      zoomAccountId,
      lendingpadClientId,
      lendingpadAuthorizeUrl,
      lendingpadTokenUrl,
      dataFeedBaseUrl,
      encompassUsername,
      encompassClientId,
      encompassTokenUrl,
    }: ValidationRequest = await req.json();

    if (!provider) {
      return jsonValidationResponse({
        valid: false,
        error: 'Provider is required',
      });
    }

    const p = provider.toLowerCase();

    // Browsers often do not receive full secrets (RLS); merge from integration_settings for test flows.
    let resolvedApiKey = (apiKey ?? '').trim();
    let resolvedZoomClientId = (zoomClientId ?? '').trim();
    let resolvedZoomAccountId = (zoomAccountId ?? '').trim();
    let resolvedZoomSyncUserId = '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      const mergeKeyFromDb = async (providerName: string) => {
        if (resolvedApiKey) return;
        const { data: row } = await supabase
          .from('integration_settings')
          .select('api_key, config')
          .eq('provider_name', providerName)
          .maybeSingle();
        if (typeof row?.api_key === 'string' && row.api_key.trim()) {
          resolvedApiKey = row.api_key.trim();
        }
        return row;
      };

      if (
        !resolvedApiKey &&
        (p === 'openai' ||
          p === 'anthropic' ||
          p === 'google' ||
          p === 'perplexity' ||
          p === 'sendgrid' ||
          p === 'zoom' ||
          p === 'lendingpad' ||
          p === 'encompass' ||
          isDataFeedProvider(p))
      ) {
        await mergeKeyFromDb(p);
      }

      if (p === 'zoom') {
        const { data: row } = await supabase
          .from('integration_settings')
          .select('config')
          .eq('provider_name', 'zoom')
          .maybeSingle();
        const cfg = (row?.config ?? {}) as Record<string, string>;
        if (!resolvedZoomClientId && cfg.client_id) resolvedZoomClientId = cfg.client_id.trim();
        if (!resolvedZoomAccountId && cfg.account_id) resolvedZoomAccountId = cfg.account_id.trim();
        resolvedZoomSyncUserId = (cfg.sync_user_id || '').trim();
      }
    }
    if (p === 'zoom' && !resolvedZoomSyncUserId) {
      resolvedZoomSyncUserId = Deno.env.get('ZOOM_SYNC_USER_ID')?.trim() || '';
    }

    if (p !== 'zoom' && p !== 'lendingpad' && p !== 'encompass' && !isDataFeedProvider(p) && !resolvedApiKey) {
      return jsonValidationResponse({
        valid: false,
        error: 'Provider and API key are required',
      });
    }

    if (p === 'zoom') {
      if (!resolvedApiKey || !resolvedZoomClientId || !resolvedZoomAccountId) {
        return jsonValidationResponse({
          valid: false,
          error: 'Zoom requires Client Secret, Client ID, and Account ID (save in Integration Hub first).',
        });
      }
    }

    let result: ValidationResponse;

    switch (p) {
      case 'openai':
        result = await validateOpenAI(resolvedApiKey);
        break;
      case 'anthropic':
        result = await validateAnthropic(resolvedApiKey);
        break;
      case 'google':
        result = await validateGoogle(resolvedApiKey);
        break;
      case 'perplexity':
        result = await validatePerplexity(resolvedApiKey);
        break;
      case 'lendingpad': {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceKey) {
          result = { valid: false, error: 'Server configuration incomplete.' };
        } else {
          const supabase = createClient(supabaseUrl, serviceKey);
          result = await validateLendingPad(supabase, {
            apiKey: resolvedApiKey,
            lendingpadClientId,
            lendingpadAuthorizeUrl,
            lendingpadTokenUrl,
          });
        }
        break;
      }
      case 'encompass': {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceKey) {
          result = { valid: false, error: 'Server configuration incomplete.' };
        } else {
          const supabase = createClient(supabaseUrl, serviceKey);
          result = await validateEncompass(supabase, {
            apiKey: resolvedApiKey,
            encompassUsername,
            encompassClientId,
            encompassTokenUrl,
          });
        }
        break;
      }
      case 'zoom':
        result = await validateZoom(
          resolvedApiKey,
          resolvedZoomClientId,
          resolvedZoomAccountId,
          resolvedZoomSyncUserId,
        );
        break;
      case 'sendgrid':
        result = await validateSendGrid(resolvedApiKey);
        break;
      case 'hubspot':
      case 'freddie-mac':
      case 'fannie-mae':
      case 'credit-bureau':
      case 'voe-provider':
      case 'avm-provider':
      case 'aus-fannie-du':
      case 'aus-freddie-lp':
      case 'investor-tpo-connector':
      case 'hedge-data-vendor':
      case 'appraisal-amc-stub':
      case 'flood-cert-vendor-stub':
      case 'title-vendor-stub':
      case 'homeowners-insurance-vendor-stub':
      case 'ron-provider-stub':
      case 'eclose-platform-stub':
      case 'adverse-action-notice-stub': {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceKey) {
          result = { valid: false, error: 'Server configuration incomplete.' };
        } else {
          const supabase = createClient(supabaseUrl, serviceKey);
          result = await validateDataFeed(supabase, p, {
            apiKey: resolvedApiKey,
            dataFeedBaseUrl,
          });
        }
        break;
      }
      default:
        result = {
          valid: false,
          error: `Provider '${provider}' is not supported yet`,
        };
    }

    const enriched: ValidationResponse = {
      ...result,
      mode:
        result.mode ??
        (p === "openai" || p === "anthropic" || p === "google" || p === "perplexity" || p === "zoom" || p === "sendgrid"
          ? "full_validation"
          : isDataFeedProvider(p)
            ? "connectivity_check"
            : p === "lendingpad"
              ? "config_check"
              : "stub"),
      action_required:
        result.action_required ??
        (result.valid
          ? undefined
          : "Review credentials/settings and re-test in Admin > Integrations."),
    };

    return jsonValidationResponse(enriched);
  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: (error as Error).message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
