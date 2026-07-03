import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const body = (await req.json().catch(() => ({}))) as { optional_symbol?: string };
    const optionalSymbol =
      typeof body.optional_symbol === 'string' && body.optional_symbol.trim()
        ? body.optional_symbol.trim().slice(0, 64)
        : null;

    const today = new Date().toISOString().slice(0, 10);

    const { data: locks, error: locksErr } = await userClient
      .from('rate_locks')
      .select('id, loan_id, lock_expiration, loans(loan_amount, status)')
      .in('status', ['active', 'extended', 'relocked'])
      .gte('lock_expiration', today);

    if (locksErr) {
      console.error('compute-hedge-snapshot locks', locksErr);
      return new Response(JSON.stringify({ error: 'Failed to load locks' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const byLoan = new Map<string, number>();
    for (const row of locks ?? []) {
      const loan = row.loans as { loan_amount?: unknown; status?: string } | null;
      if (!loan || loan.status === 'closed') continue;
      const amt = loan.loan_amount != null ? Number(loan.loan_amount) : 0;
      const lid = row.loan_id as string;
      if (!byLoan.has(lid)) byLoan.set(lid, amt);
    }

    const locked_volume = [...byLoan.values()].reduce((a, b) => a + b, 0);
    const active_lock_count = (locks ?? []).filter((r) => {
      const loan = r.loans as { status?: string } | null;
      return loan?.status !== 'closed';
    }).length;

    const { data: assumption } = await userClient
      .from('hedge_assumptions_versions')
      .select('*')
      .eq('is_active', true)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: snapshot, error: insErr } = await userClient
      .from('hedge_pipeline_snapshots')
      .insert({
        snapshot_date: today,
        locked_volume,
        active_lock_count,
        totals: {
          unique_loans_locked: byLoan.size,
          as_of: today,
        },
        assumptions_snapshot: assumption ?? null,
        computed_by: user.id,
        optional_symbol: optionalSymbol,
      })
      .select('*')
      .single();

    if (insErr) {
      console.error('compute-hedge-snapshot insert', insErr);
      return new Response(JSON.stringify({ error: 'Failed to save snapshot' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, snapshot }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('compute-hedge-snapshot', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
