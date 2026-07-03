/**
 * Staff-only: create borrower portal magic link (raw token returned once).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { randomInviteToken, sha256Hex } from '../_shared/portal-jwt.ts';
import { assertStaffCanAccessLoan } from '../_shared/staff-loan-access.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INVITE_TTL_DAYS = 7;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), {
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({})) as { loan_id?: string };
    const loan_id = body.loan_id;
    if (!loan_id) {
      return new Response(JSON.stringify({ error: 'loan_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const service = createClient(supabaseUrl, serviceKey);
    const access = await assertStaffCanAccessLoan(userClient, service, user.id, loan_id);
    if (!access.ok) {
      return new Response(JSON.stringify({ error: access.message }), {
        status: access.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: loan, error: loanErr } = await service
      .from('loans')
      .select('id, borrower_id, loan_number')
      .eq('id', loan_id)
      .maybeSingle();

    if (loanErr || !loan?.borrower_id) {
      return new Response(JSON.stringify({ error: 'Loan or borrower not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: borrowerRow } = await service
      .from('borrowers')
      .select('email')
      .eq('id', loan.borrower_id)
      .maybeSingle();

    const borrowerEmail = borrowerRow?.email;
    if (!borrowerEmail?.trim()) {
      return new Response(
        JSON.stringify({
          error: 'Borrower has no email on file. Add an email before sending a portal link.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const rawToken = randomInviteToken();
    const token_hash = await sha256Hex(rawToken);
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + INVITE_TTL_DAYS);

    const { data: invite, error: insErr } = await service
      .from('borrower_portal_invites')
      .insert({
        token_hash,
        loan_id,
        borrower_id: loan.borrower_id,
        expires_at: expires_at.toISOString(),
        created_by: user.id,
      })
      .select('id, expires_at')
      .single();

    if (insErr || !invite) {
      console.error(insErr);
      return new Response(JSON.stringify({ error: 'Failed to create invite' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appBase =
      (Deno.env.get('BORROWER_PORTAL_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(
        /\/$/,
        '',
      );
    const invite_link = `${appBase}/portal?token=${rawToken}`;

    return new Response(
      JSON.stringify({
        invite_id: invite.id,
        token: rawToken,
        expires_at: invite.expires_at,
        invite_link,
        borrower_email: borrowerEmail,
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
