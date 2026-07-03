/**
 * LendingPad OAuth callback
 * Reads client_id + client_secret + token_url from integration_settings,
 * exchanges code for tokens, stores tokens back in the config JSON,
 * and sets validation_status = 'valid'.
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
    const body = await req.json();
    const code: string = body?.code;
    const redirect_uri: string = body?.redirect_uri || '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: setting, error: fetchErr } = await supabase
      .from('integration_settings')
      .select('id, api_key, config')
      .eq('provider_name', 'lendingpad')
      .maybeSingle();

    if (fetchErr || !setting) {
      return new Response(
        JSON.stringify({ error: 'LendingPad is not configured.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = (setting.config ?? {}) as Record<string, string>;
    const clientId = config.client_id;
    const clientSecret = setting.api_key;
    const tokenUrl = config.token_url;

    if (!code || !clientId || !clientSecret || !tokenUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing auth code or LendingPad credentials (client id / secret / token URL).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('LendingPad token error:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange code for tokens. Verify credentials and redirect URI.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenRes.json();
    const expiresIn = tokens.expires_in;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const updatedConfig = {
      ...config,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: expiresAt,
    };

    await supabase
      .from('integration_settings')
      .update({
        config: updatedConfig,
        validation_status: 'valid',
        validation_error: null,
        last_validated_at: new Date().toISOString(),
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
