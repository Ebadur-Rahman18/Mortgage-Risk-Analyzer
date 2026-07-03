/**
 * LOS Sync — LendingPad
 * OAuth Bearer + configurable REST paths (per your LendingPad API agreement).
 * Upserts borrowers + loans with data_source = lendingpad and external_id from the LOS.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/require-admin.ts';
import {
  extractLoanArray,
  normalizeBaseUrl,
  normalizeLoanStatus,
  pickNumber,
  pickString,
} from '../_shared/lendingpad-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function coerceArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');
}

function normalizeConditionStatus(raw: string): string {
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  const allowed = new Set(['pending', 'received', 'waived', 'expired', 'cleared']);
  if (allowed.has(s)) return s;
  if (s.includes('clear') || s.includes('satisfied')) return 'cleared';
  if (s.includes('waiv')) return 'waived';
  if (s.includes('receiv') || s.includes('provided')) return 'received';
  if (s.includes('expir')) return 'expired';
  return 'pending';
}

function normalizeConditionType(raw: string): string {
  const s = raw.toUpperCase().replace(/\s+/g, '');
  if (s === 'PTD' || s.includes('PRIORTODOC')) return 'PTD';
  if (s === 'PTF' || s.includes('PRIORTOFUND')) return 'PTF';
  if (s === 'PTC' || s.includes('PRIORTOCLOSE')) return 'PTC';
  return 'PTD';
}

function normalizeMilestoneType(raw: string): string {
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  const allowed = new Set([
    'application_received',
    'submitted_to_uw',
    'conditional_approval',
    'clear_to_close',
    'docs_out',
    'funding',
    'closed',
  ]);
  if (allowed.has(s)) return s;
  if (s.includes('underwrit') || s.includes('uw')) return 'submitted_to_uw';
  if (s.includes('condition') && s.includes('approval')) return 'conditional_approval';
  if (s.includes('clear') && s.includes('close')) return 'clear_to_close';
  if (s.includes('doc')) return 'docs_out';
  if (s.includes('fund')) return 'funding';
  if (s.includes('close')) return 'closed';
  return 'application_received';
}

async function ensureAccessToken(
  supabase: ReturnType<typeof createClient>,
  settingId: string,
  config: Record<string, string>,
  clientSecret: string,
): Promise<{ accessToken: string; config: Record<string, string> }> {
  const accessToken = (config.access_token || '').trim();
  const expStr = config.token_expires_at;
  const exp = expStr ? new Date(expStr).getTime() : 0;
  const now = Date.now();
  if (accessToken && (exp === 0 || exp > now + 60_000)) {
    return { accessToken, config };
  }
  if (!config.refresh_token?.trim() || !config.token_url?.trim() || !config.client_id?.trim()) {
    throw new Error(
      'Access token missing or expired. Re-authorize LendingPad (Connect with LendingPad) or ensure refresh_token is stored.',
    );
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.refresh_token.trim(),
    client_id: config.client_id.trim(),
    client_secret: clientSecret.trim(),
  });
  const res = await fetch(config.token_url.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${t.slice(0, 500)}`);
  }
  const tok = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tok.access_token) {
    throw new Error('Token refresh response missing access_token');
  }
  const expiresIn = tok.expires_in;
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const nextConfig: Record<string, string> = {
    ...config,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || config.refresh_token,
    token_expires_at: expiresAt || '',
  };
  await supabase
    .from('integration_settings')
    .update({
      config: nextConfig as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq('id', settingId);
  return { accessToken: tok.access_token, config: nextConfig };
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

    const { data: setting, error: setErr } = await supabase
      .from('integration_settings')
      .select('id, api_key, config, is_active')
      .eq('provider_name', 'lendingpad')
      .maybeSingle();

    if (setErr || !setting || !setting.is_active) {
      return new Response(
        JSON.stringify({ error: 'LendingPad integration is not configured or disabled.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const clientSecret = typeof setting.api_key === 'string' ? setting.api_key : '';
    if (!clientSecret.trim()) {
      return new Response(
        JSON.stringify({ error: 'Client secret missing in integration_settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let config = (setting.config ?? {}) as Record<string, string>;
    const envBase = Deno.env.get('LENDINGPAD_API_BASE_URL')?.trim();
    const apiBase = normalizeBaseUrl(
      (config.api_base_url || envBase || 'https://api.lendingpad.com').trim(),
    );
    const loansPath = (config.loans_list_path || '/api/v1/loans').trim();
    const loansUrl = `${apiBase}${loansPath.startsWith('/') ? '' : '/'}${loansPath}`;

    const officerId =
      (config.default_loan_officer_user_id || Deno.env.get('LENDINGPAD_DEFAULT_LOAN_OFFICER_ID') || '').trim();
    if (!officerId || !/^[0-9a-f-]{36}$/i.test(officerId)) {
      return new Response(
        JSON.stringify({
          error:
            'Set default_loan_officer_user_id in LendingPad integration config (UUID of an auth user who will own synced loans), or set LENDINGPAD_DEFAULT_LOAN_OFFICER_ID secret.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { accessToken, config: cfg2 } = await ensureAccessToken(
      supabase,
      setting.id,
      config,
      clientSecret,
    );
    config = cfg2;

    const listRes = await fetch(loansUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      return new Response(
        JSON.stringify({
          error: `LendingPad API error ${listRes.status}`,
          detail: errText.slice(0, 2000),
          loans_url: loansUrl,
          hint:
            'Confirm api_base_url and loans_list_path match your LendingPad API agreement. Common paths: /api/v1/loans, /loans.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const json = await listRes.json();
    const rows = extractLoanArray(json);
    let upserted = 0;
    let conditionsUpserted = 0;
    let milestonesUpserted = 0;
    const errors: string[] = [];

    for (const raw of rows) {
      try {
        const extId = pickString(raw, ['id', 'loan_id', 'loanId', 'external_id', 'loanNumber', 'loan_number']);
        if (!extId) {
          errors.push('skip: missing loan id');
          continue;
        }
        const loanNumber = pickString(raw, ['loan_number', 'loanNumber', 'number', 'loan_id', 'id']) || `LP-${extId}`;
        const status = normalizeLoanStatus(pickString(raw, ['status', 'loan_status', 'status_name']) || 'processing');
        const loanAmount = pickNumber(raw, ['loan_amount', 'loanAmount', 'amount', 'base_loan_amount']);
        const purpose = pickString(raw, ['purpose', 'loan_purpose', 'loanPurpose']) || null;
        const occ = pickString(raw, ['occupancy_type', 'occupancyType', 'occupancy']) || null;
        const propAddr = pickString(raw, ['property_address', 'propertyAddress', 'address', 'subject_property_address']);
        const propCity = pickString(raw, ['property_city', 'propertyCity', 'city']);
        const propState = pickString(raw, ['property_state', 'propertyState', 'state']);
        const propZip = pickString(raw, ['property_postal_code', 'propertyPostalCode', 'zip', 'postal_code']);
        const ltv = pickNumber(raw, ['ltv', 'LTV', 'ltv_ratio']);
        const dti = pickNumber(raw, ['dti', 'DTI', 'dti_ratio']);
        const credit = pickNumber(raw, ['credit_score', 'creditScore', 'fico', 'representative_credit_score']);

        let borrowerId: string | null = null;
        const rb = raw.borrower;
        let bObj: Record<string, unknown> | null = null;
        if (Array.isArray(rb) && rb[0] && typeof rb[0] === 'object') {
          bObj = rb[0] as Record<string, unknown>;
        } else if (rb && typeof rb === 'object') {
          bObj = rb as Record<string, unknown>;
        }
        if (!bObj && raw.borrower_info && typeof raw.borrower_info === 'object') {
          bObj = raw.borrower_info as Record<string, unknown>;
        }
        const extBorrower =
          pickString(bObj || {}, ['id', 'borrower_id', 'borrowerId', 'contact_id']) ||
          `lp-borrower-${extId}`;
        const firstName = pickString(bObj || {}, ['first_name', 'firstName', 'first']) || 'Borrower';
        const lastName = pickString(bObj || {}, ['last_name', 'lastName', 'last']) || 'Unknown';

        const { data: existingBorrower } = await supabase
          .from('borrowers')
          .select('id')
          .eq('external_id', extBorrower)
          .eq('data_source', 'lendingpad')
          .maybeSingle();

        if (existingBorrower?.id) {
          borrowerId = existingBorrower.id;
          await supabase
            .from('borrowers')
            .update({
              first_name: firstName.slice(0, 100),
              last_name: lastName.slice(0, 100),
              updated_at: new Date().toISOString(),
              api_payload: raw as unknown as Record<string, unknown>,
            })
            .eq('id', borrowerId);
        } else {
          const { data: insB, error: bErr } = await supabase
            .from('borrowers')
            .insert({
              first_name: firstName.slice(0, 100),
              last_name: lastName.slice(0, 100),
              data_source: 'lendingpad',
              external_id: extBorrower.slice(0, 255),
              api_payload: raw as unknown as Record<string, unknown>,
            })
            .select('id')
            .single();
          if (bErr || !insB?.id) {
            errors.push(`borrower ${extBorrower}: ${bErr?.message || 'insert failed'}`);
            continue;
          }
          borrowerId = insB.id;
        }

        const { data: existingLoan } = await supabase
          .from('loans')
          .select('id')
          .eq('external_id', extId)
          .eq('data_source', 'lendingpad')
          .maybeSingle();

        const loanPayload = {
          loan_number: loanNumber.slice(0, 50),
          borrower_id: borrowerId!,
          loan_officer_id: officerId,
          status,
          loan_amount: loanAmount,
          purpose: purpose ? purpose.slice(0, 50) : null,
          occupancy_type: occ ? occ.slice(0, 50) : null,
          property_address: propAddr ? propAddr.slice(0, 255) : null,
          property_city: propCity ? propCity.slice(0, 100) : null,
          property_state: propState ? propState.slice(0, 50) : null,
          property_postal_code: propZip ? propZip.slice(0, 20) : null,
          ltv,
          dti,
          credit_score: credit !== null ? Math.round(credit) : null,
          data_source: 'lendingpad',
          external_id: extId.slice(0, 255),
          api_payload: raw as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        };

        let loanId = existingLoan?.id || null;
        if (existingLoan?.id) {
          const { error: uErr } = await supabase.from('loans').update(loanPayload).eq('id', existingLoan.id);
          if (uErr) errors.push(`loan ${extId}: ${uErr.message}`);
          else upserted++;
        } else {
          const { data: insertedLoan, error: iErr } = await supabase.from('loans').insert({
            ...loanPayload,
            created_by: adminCheck.userId,
          }).select('id').single();
          if (iErr) errors.push(`loan ${extId}: ${iErr.message}`);
          else {
            upserted++;
            loanId = insertedLoan?.id || null;
          }
        }

        if (!loanId) {
          const { data: loanRow } = await supabase
            .from('loans')
            .select('id')
            .eq('external_id', extId)
            .eq('data_source', 'lendingpad')
            .maybeSingle();
          loanId = loanRow?.id || null;
        }
        if (!loanId) continue;

        const conditionRows = coerceArray(raw.conditions)
          .concat(coerceArray(raw.loan_conditions))
          .concat(coerceArray(raw.underwriting_conditions));
        for (const cond of conditionRows) {
          const conditionExternalId = pickString(cond, ['id', 'condition_id', 'conditionId', 'external_id']);
          const description = pickString(cond, ['description', 'name', 'title']) || 'Imported LOS condition';
          const conditionType = normalizeConditionType(
            pickString(cond, ['condition_type', 'type', 'bucket']) || 'PTD',
          );
          const conditionStatus = normalizeConditionStatus(
            pickString(cond, ['status', 'condition_status']) || 'pending',
          );
          const category = pickString(cond, ['category', 'group']) || null;
          const dueDate = pickString(cond, ['due_date', 'dueDate']) || null;
          const receivedAt = pickString(cond, ['received_at', 'receivedAt']) || null;
          const notes = pickString(cond, ['notes', 'note', 'comment']) || null;

          const lookup = conditionExternalId
            ? supabase
                .from('loan_conditions')
                .select('id')
                .eq('loan_id', loanId)
                .eq('external_id', conditionExternalId)
                .maybeSingle()
            : supabase
                .from('loan_conditions')
                .select('id')
                .eq('loan_id', loanId)
                .eq('description', description.slice(0, 1000))
                .maybeSingle();
          const { data: existingCondition } = await lookup;

          const payload = {
            loan_id: loanId,
            condition_type: conditionType,
            category: category ? category.slice(0, 100) : null,
            description: description.slice(0, 1000),
            status: conditionStatus,
            due_date: dueDate || null,
            received_at: receivedAt || null,
            notes,
            external_id: conditionExternalId ? conditionExternalId.slice(0, 255) : null,
            updated_at: new Date().toISOString(),
          };

          if (existingCondition?.id) {
            const { error: updateConditionError } = await supabase
              .from('loan_conditions')
              .update(payload)
              .eq('id', existingCondition.id);
            if (updateConditionError) errors.push(`condition ${extId}: ${updateConditionError.message}`);
            else conditionsUpserted++;
          } else {
            const { error: insertConditionError } = await supabase.from('loan_conditions').insert({
              ...payload,
              created_by: adminCheck.userId,
            });
            if (insertConditionError) errors.push(`condition ${extId}: ${insertConditionError.message}`);
            else conditionsUpserted++;
          }
        }

        const milestoneRows = coerceArray(raw.milestones).concat(coerceArray(raw.loan_milestones));
        for (const ms of milestoneRows) {
          const milestoneExternalId = pickString(ms, ['id', 'milestone_id', 'milestoneId', 'external_id']);
          const name = pickString(ms, ['name', 'title', 'milestone']) || 'Imported LOS milestone';
          const milestoneType = normalizeMilestoneType(
            pickString(ms, ['milestone_type', 'type', 'status', 'stage']) || name,
          );
          const dueDate = pickString(ms, ['due_date', 'dueDate']) || null;
          const completedAt = pickString(ms, ['completed_at', 'completedAt']) || null;
          const notes = pickString(ms, ['notes', 'note', 'comment']) || null;

          const lookup = milestoneExternalId
            ? supabase
                .from('loan_milestones')
                .select('id')
                .eq('loan_id', loanId)
                .eq('external_id', milestoneExternalId)
                .maybeSingle()
            : supabase
                .from('loan_milestones')
                .select('id')
                .eq('loan_id', loanId)
                .eq('name', name.slice(0, 150))
                .maybeSingle();
          const { data: existingMilestone } = await lookup;

          const payload = {
            loan_id: loanId,
            milestone_type: milestoneType,
            name: name.slice(0, 150),
            due_date: dueDate || null,
            completed_at: completedAt || null,
            notes,
            external_id: milestoneExternalId ? milestoneExternalId.slice(0, 255) : null,
            updated_at: new Date().toISOString(),
          };

          if (existingMilestone?.id) {
            const { error: updateMilestoneError } = await supabase
              .from('loan_milestones')
              .update(payload)
              .eq('id', existingMilestone.id);
            if (updateMilestoneError) errors.push(`milestone ${extId}: ${updateMilestoneError.message}`);
            else milestonesUpserted++;
          } else {
            const { error: insertMilestoneError } = await supabase.from('loan_milestones').insert({
              ...payload,
              created_by: adminCheck.userId,
            });
            if (insertMilestoneError) errors.push(`milestone ${extId}: ${insertMilestoneError.message}`);
            else milestonesUpserted++;
          }
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    }

    const now = new Date().toISOString();
    const nextConfig = {
      ...config,
      last_sync_at: now,
      last_sync_loan_count: String(rows.length),
      last_sync_upserted: String(upserted),
      last_sync_errors: errors.slice(0, 20).join(' | '),
    };
    await supabase
      .from('integration_settings')
      .update({
        config: nextConfig as unknown as Record<string, unknown>,
        last_validated_at: now,
        updated_at: now,
      })
      .eq('id', setting.id);

    return new Response(
      JSON.stringify({
        success: true,
        synced_at: now,
        loans_fetched: rows.length,
        loans_upserted: upserted,
        conditions_upserted: conditionsUpserted,
        milestones_upserted: milestonesUpserted,
        loans_url: loansUrl,
        errors: errors.length ? errors.slice(0, 30) : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || 'LendingPad sync failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
