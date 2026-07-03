/**
 * admin-cronjobs — Returns cron jobs and run details from pg_cron.
 * Admin-only. Uses service role to query cron schema (not exposed via PostgREST).
 *
 * GET-style body: { action: "list_jobs" | "list_runs", limit?: number }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: 'Missing Supabase configuration' }, 500);
    }

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

    const service = createClient(supabaseUrl, serviceKey);

    const { data: roleRow } = await service
      .from('user_roles')
      .select('role')
      .eq('user_id', uid)
      .maybeSingle();

    const { data: profileRow } = await service
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();

    const role = roleRow?.role ?? profileRow?.role;
    if (role !== 'admin' && role !== 'moderator') {
      return jsonResp({ error: 'Admin access required' }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      limit?: number;
    };
    const action = body.action ?? 'list_jobs';
    const limit = Math.min(body.limit ?? 100, 500);

    if (action === 'list_jobs') {
      const { data, error } = await service.rpc('get_cron_jobs');
      if (error) {
        return jsonResp(
          {
            error:
              'Could not query cron.job. Make sure pg_cron is enabled and the get_cron_jobs() SQL wrapper function exists.',
            detail: error.message,
          },
          500,
        );
      }
      return jsonResp({ jobs: data ?? [] });
    }

    if (action === 'list_runs') {
      const { data, error } = await service.rpc('get_cron_job_run_details', { row_limit: limit });
      if (error) {
        return jsonResp({ error: 'Could not query cron.job_run_details. Make sure pg_cron is enabled and the SQL wrapper function exists.', detail: error.message }, 500);
      }
      return jsonResp({ runs: data ?? [] });
    }

    return jsonResp({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error(err);
    return jsonResp({ error: 'Internal server error' }, 500);
  }
});
