import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateLockPayload {
  loan_id: string;
  product_name: string;
  locked_rate: number;
  lock_term_days: number;
  rate_sheet_id?: string | null;
  investor_code?: string | null;
  price_at_lock?: number | null;
  /** manual | pricing_quote */
  source?: 'manual' | 'pricing_quote';
}

interface ExtendLockPayload {
  rate_lock_id: string;
  extension_days: number;
  new_rate?: number;
}

interface RelockPayload {
  rate_lock_id: string;
  product_name: string;
  locked_rate: number;
  lock_term_days: number;
}

async function syncLoanLockDates(
  supabase: ReturnType<typeof createClient>,
  loanId: string,
  lockDate: string,
  lockExpiration: string,
): Promise<void> {
  const { error } = await supabase
    .from('loans')
    .update({
      lock_date: lockDate,
      lock_expiration_date: lockExpiration,
      updated_at: new Date().toISOString(),
    })
    .eq('id', loanId);
  if (error) {
    console.error('syncLoanLockDates failed:', error);
  }
}

async function createLockAlerts(
  supabase: any,
  loanId: string,
  rateLockId: string,
  lockExpiration: string,
): Promise<void> {
  const expiry = new Date(lockExpiration);
  if (Number.isNaN(expiry.getTime())) return;

  const threeDays = new Date(expiry);
  threeDays.setDate(expiry.getDate() - 3);
  const oneDay = new Date(expiry);
  oneDay.setDate(expiry.getDate() - 1);

  const alerts = [
    {
      rate_lock_id: rateLockId,
      loan_id: loanId,
      alert_type: 'expiring_3_days',
      alert_date: threeDays.toISOString().slice(0, 10),
      title: 'Rate lock expiring in 3 days',
      message: 'This rate lock expires in 3 days. Confirm closing timeline or extend.',
    },
    {
      rate_lock_id: rateLockId,
      loan_id: loanId,
      alert_type: 'expiring_tomorrow',
      alert_date: oneDay.toISOString().slice(0, 10),
      title: 'Rate lock expiring tomorrow',
      message: 'This rate lock expires tomorrow. Take action now to avoid expiration.',
    },
    {
      rate_lock_id: rateLockId,
      loan_id: loanId,
      alert_type: 'expired',
      alert_date: expiry.toISOString().slice(0, 10),
      title: 'Rate lock expired',
      message: 'This rate lock has expired. Consider re-locking or renegotiating pricing.',
    },
  ];

  const { error } = await supabase.from('lock_alerts').insert(
    alerts.map((a) => ({
      ...a,
      metadata: {},
    })),
  );
  if (error) {
    console.error('Failed to create lock_alerts:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as
      | (CreateLockPayload & { action?: string })
      | (ExtendLockPayload & { action?: string })
      | (RelockPayload & { action?: string })
      | { action?: string; loan_id?: string; rate_lock_id?: string };

    const action = (body as any).action as string | undefined;

    if (action === 'history') {
      const loanId = (body as any).loan_id as string | undefined;
      const rateLockId = (body as any).rate_lock_id as string | undefined;

      if (!loanId && !rateLockId) {
        return new Response(JSON.stringify({ error: 'loan_id or rate_lock_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let lockQuery = supabase.from('rate_locks').select('*');
      if (loanId) {
        lockQuery = lockQuery.eq('loan_id', loanId);
      }
      if (rateLockId) {
        lockQuery = lockQuery.eq('id', rateLockId);
      }

      let histQ = supabase.from('rate_lock_history').select('*');
      if (loanId) {
        histQ = histQ.eq('loan_id', loanId);
      }
      if (rateLockId) {
        histQ = histQ.eq('rate_lock_id', rateLockId);
      }

      const [{ data: locks, error: locksError }, { data: history, error: historyError }] =
        await Promise.all([
          lockQuery.order('created_at', { ascending: false }),
          histQ.order('performed_at', { ascending: false }),
        ]);

      if (locksError || historyError) {
        const err = locksError || historyError;
        console.error('Failed to fetch lock history:', err);
        // Gracefully degrade when the rate_locks/rate_lock_history tables don't exist yet
        // (e.g. PGRST205 "Could not find the table ... in the schema cache").
        const code = (err as { code?: string } | null)?.code;
        if (code === 'PGRST205' || code === '42P01') {
          return new Response(
            JSON.stringify({ locks: [], history: [], fallback: true, reason: 'rate_locks_not_provisioned' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ locks: [], history: [], fallback: true, error: 'Failed to fetch lock history' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ locks: locks ?? [], history: history ?? [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      const payload = body as CreateLockPayload;
      if (!payload.loan_id || !payload.product_name || !payload.locked_rate || !payload.lock_term_days) {
        return new Response(
          JSON.stringify({
            error: 'loan_id, product_name, locked_rate, and lock_term_days are required',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const lockDate = new Date();
      const expiration = new Date(lockDate);
      expiration.setDate(lockDate.getDate() + payload.lock_term_days);

      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('id, branch_id')
        .eq('id', payload.loan_id)
        .single();

      if (loanError || !loan) {
        return new Response(JSON.stringify({ error: 'Loan not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('rate_locks')
        .update({ status: 'expired' })
        .eq('loan_id', payload.loan_id)
        .eq('status', 'active');

      const insertRow: Record<string, unknown> = {
        loan_id: payload.loan_id,
        branch_id: loan.branch_id ?? null,
        product_name: payload.product_name,
        locked_rate: payload.locked_rate,
        lock_date: lockDate.toISOString().slice(0, 10),
        lock_expiration: expiration.toISOString().slice(0, 10),
        lock_term_days: payload.lock_term_days,
        status: 'active',
        source: payload.source ?? 'manual',
      };
      if (payload.rate_sheet_id) insertRow.rate_sheet_id = payload.rate_sheet_id;
      if (payload.investor_code != null && String(payload.investor_code).trim()) {
        insertRow.investor_code = String(payload.investor_code).trim();
      }
      if (payload.price_at_lock != null && !Number.isNaN(Number(payload.price_at_lock))) {
        insertRow.price_at_lock = Number(payload.price_at_lock);
      }

      const { data: lock, error: lockError } = await supabase
        .from('rate_locks')
        .insert(insertRow)
        .select('*')
        .single();

      if (lockError || !lock) {
        console.error('Failed to create rate_lock:', lockError);
        return new Response(JSON.stringify({ error: 'Failed to create rate lock' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: histError } = await supabase.from('rate_lock_history').insert({
        rate_lock_id: lock.id,
        loan_id: payload.loan_id,
        action_type: 'lock',
        previous_rate: null,
        new_rate: payload.locked_rate,
        extension_days: null,
      });
      if (histError) {
        console.error('Failed to insert rate_lock_history (lock):', histError);
      }

      await createLockAlerts(
        supabase,
        payload.loan_id,
        lock.id as string,
        expiration.toISOString().slice(0, 10),
      );

      await syncLoanLockDates(
        supabase,
        payload.loan_id,
        lockDate.toISOString().slice(0, 10),
        expiration.toISOString().slice(0, 10),
      );

      return new Response(JSON.stringify({ lock }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'extend') {
      const payload = body as ExtendLockPayload;
      if (!payload.rate_lock_id || !payload.extension_days) {
        return new Response(
          JSON.stringify({ error: 'rate_lock_id and extension_days are required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const { data: existing, error: lockError } = await supabase
        .from('rate_locks')
        .select('*')
        .eq('id', payload.rate_lock_id)
        .single();

      if (lockError || !existing) {
        return new Response(JSON.stringify({ error: 'Rate lock not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const prevRate = existing.locked_rate as number | null;
      const newRate = payload.new_rate ?? prevRate;

      const currentExpiry = new Date(existing.lock_expiration);
      currentExpiry.setDate(currentExpiry.getDate() + payload.extension_days);

      const { data: updated, error: updateError } = await supabase
        .from('rate_locks')
        .update({
          locked_rate: newRate,
          lock_expiration: currentExpiry.toISOString().slice(0, 10),
          lock_term_days: (existing.lock_term_days ?? 0) + payload.extension_days,
          status: 'extended',
        })
        .eq('id', payload.rate_lock_id)
        .select('*')
        .single();

      if (updateError || !updated) {
        console.error('Failed to extend rate_lock:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to extend rate lock' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: histError } = await supabase.from('rate_lock_history').insert({
        rate_lock_id: updated.id,
        loan_id: updated.loan_id,
        action_type: 'extension',
        previous_rate: prevRate,
        new_rate: newRate,
        extension_days: payload.extension_days,
      });
      if (histError) {
        console.error('Failed to insert rate_lock_history (extension):', histError);
      }

      await createLockAlerts(
        supabase,
        updated.loan_id as string,
        updated.id as string,
        currentExpiry.toISOString().slice(0, 10),
      );

      await syncLoanLockDates(
        supabase,
        updated.loan_id as string,
        String(updated.lock_date),
        currentExpiry.toISOString().slice(0, 10),
      );

      return new Response(JSON.stringify({ lock: updated }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'relock') {
      const payload = body as RelockPayload;
      if (!payload.rate_lock_id || !payload.product_name || !payload.locked_rate || !payload.lock_term_days) {
        return new Response(
          JSON.stringify({
            error: 'rate_lock_id, product_name, locked_rate, and lock_term_days are required',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const { data: existing, error: lockError } = await supabase
        .from('rate_locks')
        .select('*')
        .eq('id', payload.rate_lock_id)
        .single();

      if (lockError || !existing) {
        return new Response(JSON.stringify({ error: 'Rate lock not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const prevRate = existing.locked_rate as number | null;
      const lockDate = new Date();
      const expiration = new Date(lockDate);
      expiration.setDate(lockDate.getDate() + payload.lock_term_days);

      const { data: updated, error: updateError } = await supabase
        .from('rate_locks')
        .update({
          product_name: payload.product_name,
          locked_rate: payload.locked_rate,
          lock_date: lockDate.toISOString().slice(0, 10),
          lock_expiration: expiration.toISOString().slice(0, 10),
          lock_term_days: payload.lock_term_days,
          status: 'relocked',
        })
        .eq('id', payload.rate_lock_id)
        .select('*')
        .single();

      if (updateError || !updated) {
        console.error('Failed to relock rate_lock:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to relock' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: histError } = await supabase.from('rate_lock_history').insert({
        rate_lock_id: updated.id,
        loan_id: updated.loan_id,
        action_type: 'relock',
        previous_rate: prevRate,
        new_rate: payload.locked_rate,
        extension_days: null,
      });
      if (histError) {
        console.error('Failed to insert rate_lock_history (relock):', histError);
      }

      await createLockAlerts(
        supabase,
        updated.loan_id as string,
        updated.id as string,
        expiration.toISOString().slice(0, 10),
      );

      await syncLoanLockDates(
        supabase,
        updated.loan_id as string,
        lockDate.toISOString().slice(0, 10),
        expiration.toISOString().slice(0, 10),
      );

      return new Response(JSON.stringify({ lock: updated }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('rate-locks error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

