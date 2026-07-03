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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = (body.action as string | undefined) ?? 'list';

    if (action === 'list') {
      const { data, error } = await supabase
        .from('rate_sheet_datastores')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to list datastores:', error);
        return new Response(JSON.stringify({ error: 'Failed to list datastores' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ datastores: data ?? [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      const { provider_name, connection_type, integration_notes } = body as {
        provider_name?: string;
        connection_type?: 'csv_import' | 'external_tool';
        integration_notes?: string;
      };

      if (!provider_name || !connection_type) {
        return new Response(JSON.stringify({ error: 'provider_name and connection_type are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('rate_sheet_datastores')
        .insert({
          provider_name,
          connection_type,
          integration_notes: integration_notes ?? null,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Failed to create datastore:', error);
        return new Response(JSON.stringify({ error: 'Failed to create datastore' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ datastore: data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'import') {
      const { datastore_id, csv_text } = body as {
        datastore_id?: string;
        csv_text?: string;
      };

      if (!datastore_id || !csv_text) {
        return new Response(JSON.stringify({ error: 'datastore_id and csv_text are required for import' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: datastore, error: dsError } = await supabase
        .from('rate_sheet_datastores')
        .select('*')
        .eq('id', datastore_id)
        .single();

      if (dsError || !datastore) {
        console.error('Datastore not found:', dsError);
        return new Response(JSON.stringify({ error: 'Datastore not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const lines = csv_text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length === 0) {
        return new Response(JSON.stringify({ error: 'CSV text is empty' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const header = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        const record: Record<string, string> = {};
        header.forEach((key, idx) => {
          record[key] = cols[idx] ?? '';
        });
        return record;
      });

      const now = new Date().toISOString();
      const { data: rateSheet, error: rsError } = await supabase
        .from('rate_sheets')
        .insert({
          name: `${datastore.provider_name} import ${now}`,
          source_type: 'datastore',
          created_at: now,
          datastore_source_id: datastore.id,
          metadata: { imported_via: 'datastore_import' },
        })
        .select('*')
        .single();

      if (rsError || !rateSheet) {
        console.error('Failed to create rate_sheet from datastore:', rsError);
        return new Response(JSON.stringify({ error: 'Failed to create rate sheet' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const products = rows
        .map((row) => {
          const product = row['Product'] ?? row['product'] ?? row['product_name'] ?? '';
          const loanType = row['Loan Type'] ?? row['loan_type'] ?? '';
          const rate = Number(row['Rate'] ?? row['rate'] ?? 0);
          const price = row['Price'] != null && row['Price'] !== '' ? Number(row['Price']) : null;
          const minFico = row['Min FICO'] ?? row['min_fico'];
          const maxLtv = row['Max LTV'] ?? row['max_ltv'];
          const state = row['State'] ?? row['state'] ?? '';

          return {
            rate_sheet_id: rateSheet.id,
            product_name: product,
            loan_type: loanType || null,
            rate: isFinite(rate) ? rate : null,
            price: price != null && isFinite(price) ? price : null,
            min_credit_score: minFico != null && minFico !== '' ? Number(minFico) : null,
            max_ltv: maxLtv != null && maxLtv !== '' ? Number(maxLtv) : null,
            min_loan_amount: null,
            max_loan_amount: null,
            state: state || 'ALL',
          };
        })
        .filter((p) => p.product_name && p.rate !== null);

      if (products.length > 0) {
        const size = 500;
        for (let i = 0; i < products.length; i += size) {
          const chunk = products.slice(i, i + size);
          const { error } = await supabase.from('rate_sheet_products').insert(chunk);
          if (error) {
            console.error('Failed to insert rate_sheet_products chunk (datastore import):', error);
            return new Response(JSON.stringify({ error: 'Failed to insert rate sheet products' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          rate_sheet: rateSheet,
          products_inserted: products.length,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('pricing-datastores error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

