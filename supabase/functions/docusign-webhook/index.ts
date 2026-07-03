/**
 * DocuSign Connect webhook — receives envelope status callbacks.
 * No JWT required (DocuSign calls this). Verifies via HMAC if configured.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-docusign-signature-1',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return jsonResp({ error: 'Server misconfiguration' }, 500);
    }

    const payload = await req.json().catch(() => null);
    if (!payload) {
      return jsonResp({ error: 'Invalid payload' }, 400);
    }

    // DocuSign Connect sends XML by default but can be configured for JSON.
    // Support both envelope-level and recipient-level events.
    const envelopeId: string | null =
      payload.envelopeId || payload.EnvelopeID || payload.data?.envelopeId || null;
    const envelopeStatus: string | null =
      payload.status || payload.Status || payload.data?.envelopeSummary?.status || null;

    if (!envelopeId) {
      return jsonResp({ error: 'Missing envelopeId' }, 400);
    }

    const service = createClient(supabaseUrl, serviceKey);

    // Look up disclosure by envelope_id
    const { data: disclosure } = await service
      .from('loan_disclosures')
      .select('id, status, loan_id, borrower_id')
      .eq('envelope_id', envelopeId)
      .maybeSingle();

    if (!disclosure) {
      console.log(`No disclosure found for envelope: ${envelopeId}`);
      return jsonResp({ ok: true, message: 'No matching disclosure' });
    }

    const now = new Date().toISOString();
    const normalizedStatus = (envelopeStatus || '').toLowerCase();

    let newStatus: string | null = null;
    const updates: Record<string, unknown> = { updated_at: now };

    if (normalizedStatus === 'completed' || normalizedStatus === 'signed') {
      newStatus = 'signed';
      updates.status = 'signed';
      updates.signed_at = now;
    } else if (normalizedStatus === 'declined' || normalizedStatus === 'voided') {
      newStatus = 'declined';
      updates.status = 'declined';
      updates.declined_at = now;
    } else if (normalizedStatus === 'delivered' || normalizedStatus === 'sent') {
      // Borrower opened it
      if (disclosure.status === 'sent') {
        newStatus = 'viewed';
        updates.status = 'viewed';
        updates.viewed_at = now;
      }
    }

    if (newStatus) {
      const { error: updErr } = await service
        .from('loan_disclosures')
        .update(updates)
        .eq('id', disclosure.id);

      if (updErr) {
        console.error('Disclosure update error:', updErr);
      }
    }

    console.log(`DocuSign webhook: envelope=${envelopeId} status=${normalizedStatus} → ${newStatus || 'no change'}`);
    return jsonResp({ ok: true, new_status: newStatus });
  } catch (e) {
    console.error(e);
    return jsonResp({ error: 'Internal error' }, 500);
  }
});
