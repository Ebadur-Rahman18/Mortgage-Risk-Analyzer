/**
 * LendingPad OAuth start
 * Reads client_id + authorize_url from integration_settings, returns redirect URL
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const redirect_uri: string = body?.redirect_uri || '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: setting, error } = await supabase
      .from('integration_settings')
      .select('config')
      .eq('provider_name', 'lendingpad')
      .maybeSingle();

    if (error || !setting) {
      return new Response(
        JSON.stringify({ error: 'LendingPad is not configured. Save credentials in Admin > Integrations first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = setting.config as Record<string, string> | null;
    const clientId = config?.client_id;
    const authorizeUrl = config?.authorize_url;
    const scope = config?.scope || 'loans conditions';

    if (!clientId || !authorizeUrl) {
      return new Response(
        JSON.stringify({ error: 'LendingPad Client ID or Authorize URL missing. Update credentials in Admin > Integrations.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const state = generateState();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect_uri,
      response_type: 'code',
      scope: scope,
      state: state,
    });
    const url = authorizeUrl + '?' + params.toString();

    return new Response(JSON.stringify({ url, state }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
