/**
 * Generic data-feed sync: GET config.base_url (optional path) with Bearer api_key.
 * Stores last sync metadata in integration_settings.config for configured providers (or any HTTPS vendor URL).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/require-admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FEEDS = ['hubspot', 'encompass', 'freddie-mac', 'fannie-mae', 'credit-bureau', 'voe-provider', 'avm-provider'] as const;

function normalizeUrl(base: string, path: string): string {
  const b = base.trim().replace(/\/+$/, '');
  const p = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`;
  if (!b.startsWith('http')) return `https://${b}${p}`;
  return `${b}${p}`;
}

function parseEncompassSecrets(rawApiKey: unknown): { password: string; clientSecret: string } | null {
  if (typeof rawApiKey !== 'string' || !rawApiKey.trim()) return null;
  try {
    const parsed = JSON.parse(rawApiKey) as { password?: string; clientSecret?: string };
    const password = (parsed.password || '').trim();
    const clientSecret = (parsed.clientSecret || '').trim();
    if (!password || !clientSecret) return null;
    return { password, clientSecret };
  } catch {
    return null;
  }
}

function resolveEncompassInstanceId(cfg: Record<string, string>, username: string): string {
  const fromConfig = (cfg.encompass_instance_id || '').trim();
  if (fromConfig) return fromConfig;
  const marker = username.lastIndexOf(':');
  if (marker === -1 || marker === username.length - 1) return '';
  return username.slice(marker + 1).trim();
}

const HUBSPOT_JSON_CAP = 350_000;

async function hubspotFetchList(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number; items: Record<string, unknown>[]; errorSnippet: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 22_000);
  try {
    const res = await fetch(normalizeUrl(baseUrl, path), {
      method: 'GET',
      headers,
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, items: [], errorSnippet: text.slice(0, 800) };
    }
    const j = JSON.parse(text) as { results?: Record<string, unknown>[] };
    const items = Array.isArray(j.results) ? j.results : [];
    return { ok: true, status: res.status, items, errorSnippet: '' };
  } catch (e) {
    return { ok: false, status: 0, items: [], errorSnippet: (e as Error).message || 'request failed' };
  } finally {
    clearTimeout(t);
  }
}

function capJsonString(obj: unknown): string {
  const s = JSON.stringify(obj);
  if (s.length <= HUBSPOT_JSON_CAP) return s;
  return `${s.slice(0, HUBSPOT_JSON_CAP)}…`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const adminCheck = await requireAdmin(req.headers.get('Authorization'), supabaseUrl, anonKey, serviceKey);
    if (!adminCheck.ok) {
      return new Response(JSON.stringify({ error: adminCheck.message }), {
        status: adminCheck.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as { provider?: string };
    const provider = (body.provider || '').toLowerCase().trim();
    if (!FEEDS.includes(provider as (typeof FEEDS)[number])) {
      return new Response(
        JSON.stringify({
          error:
            'Invalid provider. Use hubspot | encompass | freddie-mac | fannie-mae | credit-bureau | voe-provider | avm-provider.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: row, error } = await supabase
      .from('integration_settings')
      .select('id, api_key, config, is_active')
      .eq('provider_name', provider)
      .maybeSingle();

    if (error || !row || !row.is_active) {
      return new Response(
        JSON.stringify({ error: 'Data feed is not configured or is disabled in Integration Hub.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const cfg = (row.config ?? {}) as Record<string, string>;
    const baseUrl = (cfg.base_url || '').trim();
    if (!baseUrl) {
      return new Response(
        JSON.stringify({
          error: 'Set API base URL in the data feed card (your vendor or aggregator HTTPS endpoint).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const pathSuffix = (cfg.sync_path || '/').trim() || '/';
    const url = normalizeUrl(baseUrl, pathSuffix);
    const apiKey = typeof row.api_key === 'string' ? row.api_key.trim() : '';
    const isEncompass = provider === 'encompass';

    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
    };
    if (isEncompass) {
      const secrets = parseEncompassSecrets(apiKey);
      const username = (cfg.encompass_username || '').trim();
      const clientId = (cfg.encompass_client_id || '').trim();
      const instanceId = resolveEncompassInstanceId(cfg, username);
      const tokenUrl = (cfg.encompass_token_url || 'https://api.elliemae.com/oauth2/v1/token').trim();
      if (!secrets || !username || !clientId) {
        return new Response(
          JSON.stringify({
            error: 'Encompass config incomplete. Save username, client_id, password, and client_secret in Integration Hub.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const tokenBody = new URLSearchParams({
        grant_type: 'password',
        username,
        password: secrets.password,
        client_id: clientId,
        client_secret: secrets.clientSecret,
      });
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });
      const tokenRaw = await tokenRes.text();
      if (!tokenRes.ok) {
        return new Response(
          JSON.stringify({ error: `Encompass auth failed (HTTP ${tokenRes.status}). ${tokenRaw.slice(0, 250)}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const tokenJson = JSON.parse(tokenRaw) as { access_token?: string };
      if (!tokenJson.access_token) {
        return new Response(
          JSON.stringify({ error: 'Encompass auth response missing access_token.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      headers.Authorization = `Bearer ${tokenJson.access_token}`;
      // Encompass API gateways can require the app/client identifier on resource calls.
      headers['x-elli-api-client-id'] = clientId;
      if (instanceId) {
        // Some Encompass tenants also require explicit instance scoping per request.
        headers['x-elli-instance-id'] = instanceId;
      }
    } else if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    /** HubSpot: fetch standard contacts + deals lists for the Pipeline page (ignores sync_path). */
    if (provider === 'hubspot' && apiKey && !isEncompass) {
      const contacts = await hubspotFetchList(baseUrl, '/crm/v3/objects/contacts?limit=100', headers);
      const deals = await hubspotFetchList(baseUrl, '/crm/v3/objects/deals?limit=100', headers);
      const now = new Date().toISOString();
      const anyOk = contacts.ok || deals.ok;
      const preview = contacts.items[0] ?? deals.items[0] ?? null;
      const partialErrors = [
        !contacts.ok ? `contacts HTTP ${contacts.status}` : null,
        !deals.ok ? `deals HTTP ${deals.status}` : null,
      ].filter(Boolean) as string[];

      const nextConfig: Record<string, string> = {
        ...cfg,
        last_sync_at: now,
        last_sync_http_status: contacts.ok && deals.ok ? '200' : String(contacts.status || deals.status),
        last_sync_ok: anyOk ? 'true' : 'false',
        last_sync_url: normalizeUrl(baseUrl, '/crm/v3/objects/contacts?limit=100'),
        last_sync_item_count: String(contacts.items.length + deals.items.length),
        last_sync_error: anyOk ? '' : [contacts.errorSnippet, deals.errorSnippet].filter(Boolean).join(' | ').slice(0, 2000),
        last_sync_preview:
          preview == null ? '' : typeof preview === 'string' ? preview.slice(0, 1500) : JSON.stringify(preview).slice(0, 1500),
        hubspot_contacts_json: capJsonString(contacts.items),
        hubspot_deals_json: capJsonString(deals.items),
        hubspot_contacts_count: String(contacts.items.length),
        hubspot_deals_count: String(deals.items.length),
        hubspot_contacts_http: String(contacts.status),
        hubspot_deals_http: String(deals.status),
        hubspot_contacts_error: contacts.ok ? '' : contacts.errorSnippet.slice(0, 2000),
        hubspot_deals_error: deals.ok ? '' : deals.errorSnippet.slice(0, 2000),
      };

      await supabase
        .from('integration_settings')
        .update({
          config: nextConfig as unknown as Record<string, unknown>,
          validation_status: anyOk ? 'valid' : 'invalid',
          validation_error:
            contacts.ok && deals.ok
              ? null
              : partialErrors.length
                ? `HubSpot: ${partialErrors.join(', ')}. Check Private App scopes (crm.objects.contacts.read, crm.objects.deals.read).`
                : 'HubSpot sync failed.',
          last_validated_at: now,
          updated_at: now,
        })
        .eq('id', row.id);

      const msgParts = [
        contacts.ok ? `${contacts.items.length} contact(s)` : `contacts failed (${contacts.status})`,
        deals.ok ? `${deals.items.length} deal(s)` : `deals failed (${deals.status})`,
      ];
      return new Response(
        JSON.stringify({
          success: anyOk,
          synced_at: now,
          url: nextConfig.last_sync_url,
          http_status: contacts.ok && deals.ok ? 200 : 207,
          item_count: contacts.items.length + deals.items.length,
          message: `${msgParts.join('; ')}. CRM data is on the Pipeline page.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45_000);
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal }).finally(() => clearTimeout(t));

    const text = await res.text();
    let itemCount = 0;
    let preview: unknown = null;
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j)) {
        itemCount = j.length;
        preview = j[0] ?? null;
      } else if (j && typeof j === 'object') {
        const o = j as Record<string, unknown>;
        const arr = o.data ?? o.results ?? o.items ?? o.records;
        if (Array.isArray(arr)) {
          itemCount = arr.length;
          preview = arr[0] ?? null;
        } else {
          preview = j;
          itemCount = 1;
        }
      }
    } catch {
      itemCount = res.ok ? 1 : 0;
      preview = text.slice(0, 500);
    }

    const now = new Date().toISOString();
    const nextConfig = {
      ...cfg,
      last_sync_at: now,
      last_sync_http_status: String(res.status),
      last_sync_ok: res.ok ? 'true' : 'false',
      last_sync_url: url,
      last_sync_item_count: String(itemCount),
      last_sync_error: res.ok ? '' : text.slice(0, 2000),
      last_sync_preview: typeof preview === 'string' ? preview : JSON.stringify(preview).slice(0, 1500),
    };

    await supabase
      .from('integration_settings')
      .update({
        config: nextConfig as unknown as Record<string, unknown>,
        validation_status: res.ok ? 'valid' : 'invalid',
        validation_error: res.ok ? null : `HTTP ${res.status}: ${text.slice(0, 500)}`,
        last_validated_at: now,
        updated_at: now,
      })
      .eq('id', row.id);

    return new Response(
      JSON.stringify({
        success: res.ok,
        synced_at: now,
        url,
        http_status: res.status,
        item_count: itemCount,
        message: res.ok
          ? `Fetched ${itemCount} record(s) (or 1 document). Response stored in integration config.`
          : isEncompass
            ? `Encompass returned HTTP ${res.status}. Check base URL/path, credentials, client/instance headers, and that the API user has access to this endpoint.`
            : `Upstream returned HTTP ${res.status}. Check base URL, path, and credentials.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = (e as Error).message || 'Sync failed';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
