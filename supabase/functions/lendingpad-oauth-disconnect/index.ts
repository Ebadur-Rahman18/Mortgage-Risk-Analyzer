/**
 * LendingPad OAuth disconnect
 * Clears tokens from integration_settings config and sets is_active = false
 */

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: setting } = await supabase
      .from('integration_settings')
      .select('id, config')
      .eq('provider_name', 'lendingpad')
      .maybeSingle();

    if (!setting) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = (setting.config ?? {}) as Record<string, unknown>;
    delete config.access_token;
    delete config.refresh_token;
    delete config.token_expires_at;

    await supabase
      .from('integration_settings')
      .update({
        config,
        is_active: false,
        validation_status: 'not_tested',
        validation_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', setting.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
