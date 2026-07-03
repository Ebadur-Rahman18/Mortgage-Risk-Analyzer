/**
 * Borrower portal: loan snapshot + conditions + milestones + messages + disclosures (portal JWT).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolvePortalJwtSecret, verifyPortalAccessToken } from '../_shared/portal-jwt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const portalSecret = await resolvePortalJwtSecret();
    if (!supabaseUrl || !serviceKey || !portalSecret) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const portalJwt = authHeader.replace(/^Bearer\s+/i, '');
    let loanId: string;
    let borrowerId: string;
    try {
      ({ loanId, borrowerId } = await verifyPortalAccessToken(portalJwt, portalSecret));
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const service = createClient(supabaseUrl, serviceKey);

    const { data: loan, error: loanErr } = await service
      .from('loans')
      .select(
        'id, loan_number, status, lock_expiration_date, lock_date, property_city, property_state, borrower_id, loan_officer_id',
      )
      .eq('id', loanId)
      .maybeSingle();

    if (loanErr || !loan || loan.borrower_id !== borrowerId) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch LO profile for messaging display
    let loan_officer_name: string | null = null;
    if (loan.loan_officer_id) {
      const { data: loProfile } = await service
        .from('profiles')
        .select('full_name, email')
        .eq('id', loan.loan_officer_id)
        .maybeSingle();
      loan_officer_name = loProfile?.full_name || loProfile?.email || null;
    }

    // Parallel fetches
    const [conditionsRes, uploadsRes, milestonesRes, messagesRes, disclosuresRes, docusignRes] =
      await Promise.all([
        service
          .from('loan_conditions')
          .select('id, condition_type, category, description, status, due_date, assigned_party, priority')
          .eq('loan_id', loanId)
          .in('status', ['pending', 'received'])
          .order('due_date', { ascending: true, nullsFirst: false }),
        service
          .from('loan_borrower_uploads')
          .select('id, file_name, submitted_at, review_status, loan_condition_id')
          .eq('loan_id', loanId)
          .order('submitted_at', { ascending: false })
          .limit(20),
        service
          .from('loan_milestones')
          .select('id, milestone_type, name, due_date, completed_at, created_at')
          .eq('loan_id', loanId)
          .order('created_at', { ascending: true }),
        service
          .from('portal_messages')
          .select('id, sender_type, sender_user_id, body, is_read, created_at')
          .eq('loan_id', loanId)
          .eq('borrower_id', borrowerId)
          .order('created_at', { ascending: false })
          .limit(30),
        service
          .from('loan_disclosures')
          .select('id, disclosure_type, title, status, signing_url, sent_at, signed_at, declined_at, created_at')
          .eq('loan_id', loanId)
          .eq('borrower_id', borrowerId)
          .order('created_at', { ascending: false }),
        service
          .from('integration_settings')
          .select('is_active')
          .eq('provider_name', 'docusign')
          .maybeSingle(),
      ]);

    return new Response(
      JSON.stringify({
        loan: {
          id: loan.id,
          loan_number: loan.loan_number,
          status: loan.status,
          lock_date: loan.lock_date,
          lock_expiration_date: loan.lock_expiration_date,
          property_city: loan.property_city,
          property_state: loan.property_state,
          loan_officer_name,
        },
        conditions: conditionsRes.data ?? [],
        recent_uploads: uploadsRes.data ?? [],
        milestones: milestonesRes.data ?? [],
        messages: (messagesRes.data ?? []).reverse(),
        disclosures: disclosuresRes.data ?? [],
        docusign_enabled: !!(docusignRes.data?.is_active),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
