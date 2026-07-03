/**
 * Public: exchange one-time invite token for portal access JWT.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolvePortalJwtSecret, sha256Hex, signPortalAccessToken } from '../_shared/portal-jwt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PORTAL_JWT_TTL_SEC = 60 * 60 * 24; // 24h

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const portalSecret = await resolvePortalJwtSecret();
    if (!supabaseUrl || !serviceKey || !portalSecret) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration (Supabase URL, service role, or portal JWT secret)' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const body = await req.json().catch(() => ({})) as {
      token?: string;
      loan_number?: string;
    };
    const token = body.token?.trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token_hash = await sha256Hex(token);
    const service = createClient(supabaseUrl, serviceKey);

    const { data: invite, error: findErr } = await service
      .from('borrower_portal_invites')
      .select('id, loan_id, borrower_id, expires_at, consumed_at')
      .eq('token_hash', token_hash)
      .maybeSingle();

    if (findErr || !invite) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invite.consumed_at) {
      return new Response(JSON.stringify({ error: 'This link has already been used' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This link has expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: loan } = await service
      .from('loans')
      .select('id, loan_number, borrower_id')
      .eq('id', invite.loan_id)
      .maybeSingle();

    if (!loan || loan.borrower_id !== invite.borrower_id) {
      return new Response(JSON.stringify({ error: 'Invalid invite' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.loan_number && body.loan_number.trim() !== loan.loan_number) {
      return new Response(JSON.stringify({ error: 'Loan number does not match this link' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const forwarded = req.headers.get('x-forwarded-for') ?? '';
    const ip = forwarded.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') ?? '';

    const { error: updErr } = await service
      .from('borrower_portal_invites')
      .update({ consumed_at: new Date().toISOString(), redeemed_ip: ip })
      .eq('id', invite.id)
      .is('consumed_at', null);

    if (updErr) {
      return new Response(JSON.stringify({ error: 'Could not redeem link' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await service.from('borrower_portal_audit').insert({
      event_type: 'invite_redeemed',
      loan_id: invite.loan_id,
      borrower_id: invite.borrower_id,
      invite_id: invite.id,
      ip,
      user_agent: userAgent,
      metadata: {},
    });

    const access_token = await signPortalAccessToken({
      secret: portalSecret,
      borrowerId: invite.borrower_id,
      loanId: invite.loan_id,
      ttlSec: PORTAL_JWT_TTL_SEC,
    });

    return new Response(
      JSON.stringify({
        access_token,
        token_type: 'Bearer',
        expires_in: PORTAL_JWT_TTL_SEC,
        loan_id: invite.loan_id,
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
