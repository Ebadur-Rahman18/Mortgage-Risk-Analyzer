/**
 * DocuSign — create envelope and send disclosure for borrower signing.
 * Called by staff (Supabase Auth JWT). Requires DocuSign integration enabled.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: 'Missing Supabase configuration' }, 500);
    }

    // Auth — staff user
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
    const uid = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as {
      loan_id: string;
      disclosure_type: string;
      title: string;
      document_base64?: string;
      document_name?: string;
    };

    const { loan_id, disclosure_type, title } = body;
    if (!loan_id || !disclosure_type || !title) {
      return jsonResp({ error: 'loan_id, disclosure_type, and title are required' }, 400);
    }

    const service = createClient(supabaseUrl, serviceKey);

    // Check DocuSign integration
    const { data: dsIntegration } = await service
      .from('integration_settings')
      .select('api_key, config, is_active')
      .eq('provider_name', 'docusign')
      .maybeSingle();

    if (!dsIntegration?.is_active || !dsIntegration.api_key) {
      return jsonResp({ error: 'DocuSign integration is not enabled' }, 400);
    }

    const dsConfig = (dsIntegration.config || {}) as Record<string, unknown>;
    const accountId = dsConfig.account_id as string;
    const baseUrl = (dsConfig.base_url as string) || 'https://demo.docusign.net/restapi';

    if (!accountId) {
      return jsonResp({ error: 'DocuSign Account ID not configured' }, 400);
    }

    // Load loan + borrower
    const { data: loan } = await service
      .from('loans')
      .select('id, loan_number, borrower_id, borrowers(id, first_name, last_name, email)')
      .eq('id', loan_id)
      .maybeSingle();

    if (!loan) {
      return jsonResp({ error: 'Loan not found' }, 404);
    }

    const borrower = (loan as any).borrowers;
    if (!borrower?.email) {
      return jsonResp({ error: 'Borrower email is required for DocuSign' }, 400);
    }

    const borrowerName = [borrower.first_name, borrower.last_name].filter(Boolean).join(' ') || 'Borrower';

    // Create DocuSign envelope
    const envelopeBody: Record<string, unknown> = {
      emailSubject: `Please sign: ${title} — Loan ${loan.loan_number}`,
      recipients: {
        signers: [
          {
            email: borrower.email,
            name: borrowerName,
            recipientId: '1',
            routingOrder: '1',
            clientUserId: borrower.id,
          },
        ],
      },
      status: 'sent',
    };

    // If a document is provided as base64
    if (body.document_base64) {
      envelopeBody.documents = [
        {
          documentBase64: body.document_base64,
          name: body.document_name || `${title}.pdf`,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ];
    } else {
      // Placeholder document — in production, generate from template
      const placeholderHtml = `<html><body><h1>${title}</h1><p>Loan: ${loan.loan_number}</p><p>Borrower: ${borrowerName}</p><p style="margin-top:40px;"><b>Signature:</b> /sn1/</p></body></html>`;
      const encoded = btoa(placeholderHtml);
      envelopeBody.documents = [
        {
          documentBase64: encoded,
          name: `${title}.html`,
          fileExtension: 'html',
          documentId: '1',
        },
      ];
    }

    let envelopeId: string | null = null;
    let signingUrl: string | null = null;

    try {
      // Create envelope
      const envRes = await fetch(
        `${baseUrl}/v2.1/accounts/${accountId}/envelopes`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${dsIntegration.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(envelopeBody),
        },
      );

      if (!envRes.ok) {
        const errText = await envRes.text().catch(() => '');
        console.error('DocuSign envelope error:', envRes.status, errText);
        return jsonResp({ error: `DocuSign API error: ${envRes.status}` }, 502);
      }

      const envData = await envRes.json();
      envelopeId = envData.envelopeId;

      // Get recipient signing URL (embedded signing)
      const viewRes = await fetch(
        `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${dsIntegration.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            returnUrl: `${Deno.env.get('BORROWER_PORTAL_APP_URL') || 'https://app.example.com'}/portal/dashboard?signed=true`,
            authenticationMethod: 'none',
            email: borrower.email,
            userName: borrowerName,
            clientUserId: borrower.id,
          }),
        },
      );

      if (viewRes.ok) {
        const viewData = await viewRes.json();
        signingUrl = viewData.url || null;
      }
    } catch (e) {
      console.error('DocuSign API error:', e);
      return jsonResp({ error: 'Failed to create DocuSign envelope' }, 502);
    }

    // Persist disclosure record
    const { data: disclosure, error: disErr } = await service
      .from('loan_disclosures')
      .insert({
        loan_id,
        borrower_id: borrower.id,
        disclosure_type,
        title,
        status: 'sent',
        envelope_id: envelopeId,
        signing_url: signingUrl,
        sent_at: new Date().toISOString(),
        created_by: uid,
        metadata: { document_name: body.document_name },
      })
      .select('id, disclosure_type, title, status, signing_url, envelope_id, sent_at')
      .single();

    if (disErr) {
      console.error('Disclosure insert error:', disErr);
      return jsonResp({ error: 'Failed to save disclosure' }, 500);
    }

    return jsonResp({ disclosure });
  } catch (e) {
    console.error(e);
    return jsonResp({ error: 'Internal error' }, 500);
  }
});
