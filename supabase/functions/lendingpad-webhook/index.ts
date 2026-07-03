import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeLoanStatus, pickNumber, pickString } from '../_shared/lendingpad-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function coerceArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');
}

function normalizeConditionStatus(raw: string): string {
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  if (s.includes('clear') || s.includes('satisfied')) return 'cleared';
  if (s.includes('waiv')) return 'waived';
  if (s.includes('receiv') || s.includes('provided')) return 'received';
  if (s.includes('expir')) return 'expired';
  return 'pending';
}

function normalizeConditionType(raw: string): string {
  const s = raw.toUpperCase().replace(/\s+/g, '');
  if (s === 'PTF' || s.includes('PRIORTOFUND')) return 'PTF';
  if (s === 'PTC' || s.includes('PRIORTOCLOSE')) return 'PTC';
  return 'PTD';
}

function normalizeMilestoneType(raw: string): string {
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  if (s.includes('underwrit') || s.includes('uw')) return 'submitted_to_uw';
  if (s.includes('condition') && s.includes('approval')) return 'conditional_approval';
  if (s.includes('clear') && s.includes('close')) return 'clear_to_close';
  if (s.includes('doc')) return 'docs_out';
  if (s.includes('fund')) return 'funding';
  if (s.includes('close')) return 'closed';
  return 'application_received';
}

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
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: setting, error: settingError } = await supabase
      .from('integration_settings')
      .select('id, is_active, config')
      .eq('provider_name', 'lendingpad')
      .maybeSingle();
    if (settingError || !setting || !setting.is_active) {
      return new Response(JSON.stringify({ error: 'LendingPad integration not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = (setting.config ?? {}) as Record<string, string>;
    const expectedSecret = (config.webhook_secret || Deno.env.get('LENDINGPAD_WEBHOOK_SECRET') || '').trim();
    const incomingSecret = (req.headers.get('x-webhook-secret') || '').trim();
    if (expectedSecret && incomingSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Invalid webhook secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ownerId =
      (config.default_loan_officer_user_id || Deno.env.get('LENDINGPAD_DEFAULT_LOAN_OFFICER_ID') || '').trim();
    if (!ownerId) {
      return new Response(JSON.stringify({ error: 'Missing default_loan_officer_user_id for webhook processing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const bodyObj = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {};
    const nestedLoans = coerceArray(bodyObj.loans);
    const rows = nestedLoans.length
      ? nestedLoans
      : Array.isArray(body)
        ? coerceArray(body)
        : (bodyObj && Object.keys(bodyObj).length ? [bodyObj] : []);
    const results: Array<{ loan_external_id: string; ok: boolean; error?: string }> = [];

    for (const raw of rows) {
      try {
        const extId = pickString(raw, ['id', 'loan_id', 'loanId', 'external_id', 'loanNumber', 'loan_number']);
        if (!extId) continue;
        const loanNumber = pickString(raw, ['loan_number', 'loanNumber', 'number', 'loan_id', 'id']) || `LP-${extId}`;
        const status = normalizeLoanStatus(pickString(raw, ['status', 'loan_status', 'status_name']) || 'processing');
        const loanAmount = pickNumber(raw, ['loan_amount', 'loanAmount', 'amount', 'base_loan_amount']);

        const { data: existingLoan } = await supabase
          .from('loans')
          .select('id')
          .eq('external_id', extId)
          .eq('data_source', 'lendingpad')
          .maybeSingle();

        let loanId = existingLoan?.id || null;
        const loanPayload = {
          loan_number: loanNumber.slice(0, 50),
          loan_officer_id: ownerId,
          status,
          loan_amount: loanAmount,
          data_source: 'lendingpad',
          external_id: extId.slice(0, 255),
          api_payload: raw as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        };

        if (existingLoan?.id) {
          const { error } = await supabase.from('loans').update(loanPayload).eq('id', existingLoan.id);
          if (error) throw error;
        } else {
          const { data: created, error } = await supabase.from('loans').insert(loanPayload).select('id').single();
          if (error) throw error;
          loanId = created?.id || null;
        }
        if (!loanId) continue;

        const conditionRows = coerceArray(raw.conditions).concat(coerceArray(raw.loan_conditions));
        for (const cond of conditionRows) {
          const externalConditionId = pickString(cond, ['id', 'condition_id', 'conditionId', 'external_id']);
          const description = pickString(cond, ['description', 'name', 'title']) || 'Imported LOS condition';
          const payload = {
            loan_id: loanId,
            condition_type: normalizeConditionType(pickString(cond, ['condition_type', 'type']) || 'PTD'),
            description: description.slice(0, 1000),
            status: normalizeConditionStatus(pickString(cond, ['status', 'condition_status']) || 'pending'),
            external_id: externalConditionId ? externalConditionId.slice(0, 255) : null,
            updated_at: new Date().toISOString(),
          };
          const { data: existingCondition } = externalConditionId
            ? await supabase
                .from('loan_conditions')
                .select('id')
                .eq('loan_id', loanId)
                .eq('external_id', externalConditionId)
                .maybeSingle()
            : await supabase
                .from('loan_conditions')
                .select('id')
                .eq('loan_id', loanId)
                .eq('description', payload.description)
                .maybeSingle();
          if (existingCondition?.id) await supabase.from('loan_conditions').update(payload).eq('id', existingCondition.id);
          else await supabase.from('loan_conditions').insert(payload);
        }

        const milestoneRows = coerceArray(raw.milestones).concat(coerceArray(raw.loan_milestones));
        for (const ms of milestoneRows) {
          const externalMilestoneId = pickString(ms, ['id', 'milestone_id', 'milestoneId', 'external_id']);
          const name = pickString(ms, ['name', 'title', 'milestone']) || 'Imported LOS milestone';
          const payload = {
            loan_id: loanId,
            milestone_type: normalizeMilestoneType(pickString(ms, ['milestone_type', 'type', 'stage']) || name),
            name: name.slice(0, 150),
            external_id: externalMilestoneId ? externalMilestoneId.slice(0, 255) : null,
            updated_at: new Date().toISOString(),
          };
          const { data: existingMilestone } = externalMilestoneId
            ? await supabase
                .from('loan_milestones')
                .select('id')
                .eq('loan_id', loanId)
                .eq('external_id', externalMilestoneId)
                .maybeSingle()
            : await supabase
                .from('loan_milestones')
                .select('id')
                .eq('loan_id', loanId)
                .eq('name', payload.name)
                .maybeSingle();
          if (existingMilestone?.id) await supabase.from('loan_milestones').update(payload).eq('id', existingMilestone.id);
          else await supabase.from('loan_milestones').insert(payload);
        }

        results.push({ loan_external_id: extId, ok: true });
      } catch (e) {
        results.push({ loan_external_id: 'unknown', ok: false, error: (e as Error).message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        failures: results.filter((r) => !r.ok).length,
        results: results.slice(0, 50),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Webhook processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
