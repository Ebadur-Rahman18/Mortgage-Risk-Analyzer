import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROVIDER = 'investor-tpo-connector';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      loan_id?: string;
      submission_id?: string;
    };
    const loanId = body.loan_id?.trim();
    const submissionId = body.submission_id?.trim();
    if (!loanId || !submissionId) {
      return new Response(JSON.stringify({ error: 'loan_id and submission_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: row, error: rowErr } = await userClient
      .from('investor_submissions')
      .select('id, loan_id, metadata, status')
      .eq('id', submissionId)
      .eq('loan_id', loanId)
      .maybeSingle();
    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: integration } = await admin
      .from('integration_settings')
      .select('is_active')
      .eq('provider_name', PROVIDER)
      .maybeSingle();

    const vendorEnabled = Boolean(integration?.is_active);
    const now = new Date().toISOString();
    const prevMeta = (row.metadata ?? {}) as Record<string, unknown>;
    const nextMeta = {
      ...prevMeta,
      submit_stub: {
        at: now,
        mode: vendorEnabled ? 'vendor_enabled_pending' : 'manual_logged',
        user_id: user.id,
      },
    };

    await userClient
      .from('investor_submissions')
      .update({ metadata: nextMeta, updated_at: now })
      .eq('id', submissionId);

    if (!vendorEnabled) {
      return new Response(JSON.stringify({ ok: true, mode: 'manual_logged' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode: 'vendor_stub',
        message: 'Investor connector is enabled; live HTTPS submission is not implemented in this build.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('submit-investor-package', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
