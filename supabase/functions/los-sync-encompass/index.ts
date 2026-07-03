/**
 * LOS Sync — Encompass (ICE Mortgage Technology)
 * OAuth password grant + Encompass v3/v1 loanPipeline endpoint.
 * Upserts borrowers + loans with data_source = 'encompass'.
 *
 * Prerequisites in Admin > Integrations > Encompass:
 *   - username, password, client_id, client_secret saved
 *   - is_active = true
 *   - config.default_loan_officer_user_id = UUID of the auth user who owns synced loans
 *
 * Optional config keys:
 *   - pipeline_version   : "v3" (default) | "v1"
 *   - pipeline_filter    : JSON string of Encompass filter object to scope results
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/require-admin.ts';
import { normalizeLoanStatus } from '../_shared/lendingpad-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Encompass canonical field names to request from the pipeline endpoint.
// V3 canonical names + numeric field IDs that work in both V1 and V3.
const PIPELINE_FIELDS = [
  'Loan.LoanNumber',
  'Borrower.FirstName',
  'Borrower.LastName',
  'Borrower.EmailAddressText',
  'Borrower.HomePhoneNumber',
  'Loan.LoanAmount',
  'Loan.LTV',
  'Loan.RequestedInterestRatePercent',
  'Loan.LoanPurpose',
  'Loan.OccupancyType',
  'Fields.11',   // Subject Property Street
  'Fields.12',   // Property City
  'Fields.14',   // Property State
  'Fields.15',   // Property Zip
  'Fields.28',   // Borrower Credit Score
  'Fields.742',  // DTI Ratio
  'Log.MS.CurrentMilestoneName',
];

const MAX_LOANS = 2000;
const PAGE_SIZE = 50;
const DEFAULT_PIPELINE_FILTER: Record<string, unknown> = {
  canonicalName: 'Loan.LoanNumber',
  matchType: 'IsNotEmpty',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSecrets(rawApiKey: unknown): { password: string; clientSecret: string } | null {
  if (typeof rawApiKey !== 'string' || !rawApiKey.trim()) return null;
  try {
    const p = JSON.parse(rawApiKey) as { password?: string; clientSecret?: string };
    const password = (p.password || '').trim();
    const clientSecret = (p.clientSecret || '').trim();
    if (!password || !clientSecret) return null;
    return { password, clientSecret };
  } catch {
    return null;
  }
}

function resolveInstanceId(cfg: Record<string, string>, username: string): string {
  const explicit = (cfg.encompass_instance_id || '').trim();
  if (explicit) return explicit;
  const sep = username.lastIndexOf(':');
  return sep !== -1 && sep < username.length - 1 ? username.slice(sep + 1).trim() : '';
}

function fieldStr(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = fields[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function fieldNum(fields: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = fields[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v.replace(/[^0-9.-]/g, ''));
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function extractPageItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');
  }
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const key of ['loans', 'data', 'results', 'items']) {
      if (Array.isArray(o[key])) {
        return (o[key] as unknown[]).filter(
          (x): x is Record<string, unknown> => x !== null && typeof x === 'object',
        );
      }
    }
  }
  return [];
}

function hasUsableFilter(filter: Record<string, unknown> | null): boolean {
  if (!filter) return false;
  if (Array.isArray(filter.terms)) return filter.terms.length > 0;
  return Boolean(filter.canonicalName && filter.matchType);
}

function isPaginationContractError(errText: string): boolean {
  const s = errText.toLowerCase();
  return s.includes('querycontract.start') || s.includes('querycontract.limit');
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
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

    // --- Load integration settings ---
    const { data: setting, error: setErr } = await supabase
      .from('integration_settings')
      .select('id, api_key, config, is_active')
      .eq('provider_name', 'encompass')
      .maybeSingle();

    if (setErr || !setting || !setting.is_active) {
      return new Response(
        JSON.stringify({ error: 'Encompass integration is not configured or is disabled in Admin > Integrations.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const cfg = (setting.config ?? {}) as Record<string, string>;
    const secrets = parseSecrets(setting.api_key);
    const username = (cfg.encompass_username || '').trim();
    const clientId = (cfg.encompass_client_id || '').trim();
    const tokenUrl = (cfg.encompass_token_url || 'https://api.elliemae.com/oauth2/v1/token').trim();
    const baseUrl = (cfg.base_url || 'https://api.elliemae.com').trim().replace(/\/+$/, '');
    const instanceId = resolveInstanceId(cfg, username);

    if (!secrets || !username || !clientId) {
      return new Response(
        JSON.stringify({
          error: 'Encompass config incomplete. Save username, client_id, password, and client_secret in Admin > Integrations.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Each synced loan is assigned to this user as the loan officer.
    // Prefer explicit integration config, otherwise use the invoking admin.
    const configuredOfficerId = (cfg.default_loan_officer_user_id || '').trim();
    const officerId = configuredOfficerId || adminCheck.userId;
    if (!officerId || !/^[0-9a-f-]{36}$/i.test(officerId)) {
      return new Response(
        JSON.stringify({
          error:
            'Unable to resolve a valid loan officer user ID for synced records.',
          hint:
            'Set default_loan_officer_user_id in Admin > Integrations > Encompass, or re-authenticate with an admin user.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Step 1: OAuth token ---
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

    if (!tokenRes.ok) {
      const raw = await tokenRes.text();
      return new Response(
        JSON.stringify({ error: `Encompass auth failed (HTTP ${tokenRes.status}): ${raw.slice(0, 400)}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: 'Encompass auth response missing access_token.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiHeaders: Record<string, string> = {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-elli-api-client-id': clientId,
    };
    if (instanceId) apiHeaders['x-elli-instance-id'] = instanceId;

    // --- Step 2: Paginate the Encompass loan pipeline ---
    const pipelineVersion = (cfg.pipeline_version || 'v3').trim().toLowerCase();
    const pipelineUrl = `${baseUrl}/encompass/${pipelineVersion}/loanPipeline`;

    let customFilter: Record<string, unknown> | null = null;
    if (cfg.pipeline_filter) {
      try {
        customFilter = JSON.parse(cfg.pipeline_filter) as Record<string, unknown>;
      } catch { /* ignore bad filter JSON */ }
    }

    const allLoans: Record<string, unknown>[] = [];
    let start = 0;

    let allowPagination = true;
    while (allLoans.length < MAX_LOANS) {
      const pipelineBody: Record<string, unknown> = {
        fields: PIPELINE_FIELDS,
        // Some tenants reject empty/missing filters.
        filter: hasUsableFilter(customFilter) ? customFilter : DEFAULT_PIPELINE_FILTER,
      };
      const query = new URLSearchParams({
        ignoreInvalidFields: 'true',
      });
      if (allowPagination) {
        query.set('start', String(start));
        query.set('limit', String(PAGE_SIZE));
      }
      let requestUrl = `${pipelineUrl}?${query.toString()}`;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      let pipelineRes = await fetch(requestUrl, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(pipelineBody),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));

      // Compatibility fallback: some Encompass tenants reject start/limit query contract mapping.
      if (!pipelineRes.ok && allowPagination) {
        const firstErr = await pipelineRes.text();
        if (pipelineRes.status === 400 && isPaginationContractError(firstErr)) {
          allowPagination = false;
          requestUrl = `${pipelineUrl}?ignoreInvalidFields=true`;
          const ctrlRetry = new AbortController();
          const timerRetry = setTimeout(() => ctrlRetry.abort(), 45_000);
          pipelineRes = await fetch(requestUrl, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify(pipelineBody),
            signal: ctrlRetry.signal,
          }).finally(() => clearTimeout(timerRetry));
        } else {
          return new Response(
            JSON.stringify({
              error: `Encompass pipeline API error (HTTP ${pipelineRes.status}): ${firstErr.slice(0, 500)}`,
              pipeline_url: requestUrl,
              hint: 'Verify the pipeline API version (v3/v1), base URL, and that the API user has pipeline access.',
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      if (!pipelineRes.ok) {
        const errText = await pipelineRes.text();
        return new Response(
          JSON.stringify({
            error: `Encompass pipeline API error (HTTP ${pipelineRes.status}): ${errText.slice(0, 500)}`,
            pipeline_url: requestUrl,
            hint: 'Verify the pipeline API version (v3/v1), base URL, and that the API user has pipeline access.',
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const pageBody = await pipelineRes.json();
      const pageItems = extractPageItems(pageBody);
      allLoans.push(...pageItems);

      if (!allowPagination) break; // fallback mode does single page only
      if (pageItems.length < PAGE_SIZE) break; // last page
      start += PAGE_SIZE;
    }

    // --- Step 3: Upsert borrowers + loans ---
    let upserted = 0;
    const errors: string[] = [];

    for (const raw of allLoans) {
      try {
        const encLoanId = fieldStr(raw, 'loanId', 'loan_id', 'id', 'loanGuid');
        if (!encLoanId) {
          errors.push('skip: item missing loanId');
          continue;
        }

        // Encompass pipeline returns { loanId, fields: { ... } }
        // Fall back to top-level keys if fields object absent
        const f = (raw.fields && typeof raw.fields === 'object'
          ? raw.fields
          : raw) as Record<string, unknown>;

        const loanNumber =
          fieldStr(f, 'Loan.LoanNumber', '2', 'loanNumber', 'loan_number') ||
          `ENC-${encLoanId.slice(0, 8).toUpperCase()}`;

        const firstName = fieldStr(f, 'Borrower.FirstName', '1268') || 'Borrower';
        const lastName = fieldStr(f, 'Borrower.LastName', '1269') || 'Unknown';
        const email = fieldStr(f, 'Borrower.EmailAddressText', '1240');
        const phone = fieldStr(f, 'Borrower.HomePhoneNumber', '1715');

        const milestoneRaw = fieldStr(f, 'Log.MS.CurrentMilestoneName', 'milestone', 'status');
        const status = normalizeLoanStatus(milestoneRaw || 'processing');

        const loanAmount = fieldNum(f, 'Loan.LoanAmount', '1109');
        const ltv = fieldNum(f, 'Loan.LTV', '353', 'Fields.353');
        const creditScore = fieldNum(f, 'Fields.28', '1699');
        const dti = fieldNum(f, 'Fields.742', 'Loan.DTIRatioPercent');
        const purpose = fieldStr(f, 'Loan.LoanPurpose', '19') || null;
        const occupancy = fieldStr(f, 'Loan.OccupancyType', '1811') || null;
        const propAddr = fieldStr(f, 'Fields.11', '1401') || null;
        const propCity = fieldStr(f, 'Fields.12', '12') || null;
        const propState = fieldStr(f, 'Fields.14', '14') || null;
        const propZip = fieldStr(f, 'Fields.15', '15') || null;

        // Upsert borrower (keyed by encompass loan ID since pipeline doesn't return borrower GUIDs)
        const extBorrower = `enc-borrower-${encLoanId}`;
        const { data: existingBorrower } = await supabase
          .from('borrowers')
          .select('id')
          .eq('external_id', extBorrower)
          .eq('data_source', 'encompass')
          .maybeSingle();

        let borrowerId: string | null = null;
        if (existingBorrower?.id) {
          borrowerId = existingBorrower.id;
          await supabase
            .from('borrowers')
            .update({
              first_name: firstName.slice(0, 100),
              last_name: lastName.slice(0, 100),
              email: email ? email.slice(0, 255) : null,
              phone: phone ? phone.slice(0, 50) : null,
              api_payload: raw as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            })
            .eq('id', borrowerId);
        } else {
          const { data: insB, error: bErr } = await supabase
            .from('borrowers')
            .insert({
              first_name: firstName.slice(0, 100),
              last_name: lastName.slice(0, 100),
              email: email ? email.slice(0, 255) : null,
              phone: phone ? phone.slice(0, 50) : null,
              data_source: 'encompass',
              external_id: extBorrower.slice(0, 255),
              api_payload: raw as unknown as Record<string, unknown>,
            })
            .select('id')
            .single();

          if (bErr || !insB?.id) {
            errors.push(`borrower for ${encLoanId}: ${bErr?.message || 'insert failed'}`);
            continue;
          }
          borrowerId = insB.id;
        }

        // Upsert loan
        const { data: existingLoan } = await supabase
          .from('loans')
          .select('id')
          .eq('external_id', encLoanId)
          .eq('data_source', 'encompass')
          .maybeSingle();

        const loanPayload = {
          loan_number: loanNumber.slice(0, 50),
          borrower_id: borrowerId!,
          loan_officer_id: officerId,
          status,
          loan_amount: loanAmount,
          ltv,
          credit_score: creditScore !== null ? Math.round(creditScore) : null,
          dti,
          purpose: purpose ? purpose.slice(0, 50) : null,
          occupancy_type: occupancy ? occupancy.slice(0, 50) : null,
          property_address: propAddr ? propAddr.slice(0, 255) : null,
          property_city: propCity ? propCity.slice(0, 100) : null,
          property_state: propState ? propState.slice(0, 50) : null,
          property_postal_code: propZip ? propZip.slice(0, 20) : null,
          data_source: 'encompass',
          external_id: encLoanId.slice(0, 255),
          api_payload: raw as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        };

        if (existingLoan?.id) {
          const { error: uErr } = await supabase
            .from('loans')
            .update(loanPayload)
            .eq('id', existingLoan.id);
          if (uErr) errors.push(`loan ${encLoanId}: ${uErr.message}`);
          else upserted++;
        } else {
          const { error: iErr } = await supabase
            .from('loans')
            .insert({ ...loanPayload, created_by: adminCheck.userId });
          if (iErr) errors.push(`loan ${encLoanId}: ${iErr.message}`);
          else upserted++;
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    }

    // --- Update sync metadata ---
    const now = new Date().toISOString();
    await supabase
      .from('integration_settings')
      .update({
        config: {
          ...cfg,
          last_sync_at: now,
          last_sync_loan_count: String(allLoans.length),
          last_sync_upserted: String(upserted),
          last_sync_errors: errors.slice(0, 20).join(' | '),
        } as unknown as Record<string, unknown>,
        validation_status: 'valid',
        last_validated_at: now,
        updated_at: now,
      })
      .eq('id', setting.id);

    return new Response(
      JSON.stringify({
        success: true,
        synced_at: now,
        loans_fetched: allLoans.length,
        loans_upserted: upserted,
        pipeline_url: pipelineUrl,
        errors: errors.length ? errors.slice(0, 30) : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[los-sync-encompass]', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || 'Encompass sync failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
