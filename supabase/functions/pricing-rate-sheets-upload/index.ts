import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UploadPayload {
  name: string;
  effective_date?: string | null;
  expiration_date?: string | null;
  source_type?: 'upload' | 'datastore';
  /** Investor / channel code (Phase 3). */
  investor_code?: string | null;
  csv_text?: string;
  /** Pre-parsed rows (e.g. from client-side Excel). Same keys as CSV headers. */
  rows?: Array<Record<string, unknown>>;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Minimal CSV parser with quoted fields. */
function parseCsv(csv: string): Array<Record<string, string>> {
  const lines: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]!;
    if (c === '"') {
      inQuote = !inQuote;
      cur += c;
    } else if ((c === '\n' || c === '\r') && !inQuote) {
      if (cur.trim().length) lines.push(cur);
      cur = '';
      if (c === '\r' && csv[i + 1] === '\n') i++;
    } else {
      cur += c;
    }
  }
  if (cur.trim().length) lines.push(cur);

  if (lines.length === 0) return [];

  function splitRow(line: string): string[] {
    const cols: string[] = [];
    let cell = '';
    let q = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]!;
      if (ch === '"') {
        q = !q;
      } else if (ch === ',' && !q) {
        cols.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cols.push(cell.trim());
    return cols.map((c) => c.replace(/^"|"$/g, '').trim());
  }

  const header = splitRow(lines[0]!).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitRow(line);
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = cols[idx] ?? '';
    });
    return record;
  });
}

function normKey(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function splitList(raw: string): string[] | null {
  if (!raw || !raw.trim()) return null;
  return raw
    .split(/[|,/]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    const payload = (await req.json()) as UploadPayload;
    if (!payload?.name || !payload.name.trim()) {
      return jsonResponse({ error: 'name is required' }, 400);
    }
    if (payload.investor_code && !/^[A-Za-z0-9_-]{2,40}$/.test(payload.investor_code.trim())) {
      return jsonResponse({ error: 'investor_code must be 2-40 chars (letters, numbers, _ or -)' }, 400);
    }
    if (payload.effective_date && payload.expiration_date && payload.expiration_date < payload.effective_date) {
      return jsonResponse({ error: 'expiration_date must be on or after effective_date' }, 400);
    }

    let tableRows: Array<Record<string, string>> = [];
    if (payload.rows && Array.isArray(payload.rows) && payload.rows.length > 0) {
      tableRows = payload.rows.map((r) => {
        const o: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) {
          o[k] = v == null ? '' : String(v);
        }
        return o;
      });
    } else if (payload.csv_text) {
      tableRows = parseCsv(payload.csv_text);
    } else {
      return jsonResponse({ error: 'csv_text or rows is required' }, 400);
    }

    const now = new Date().toISOString();
    const { data: rateSheet, error: insertError } = await supabase
      .from('rate_sheets')
      .insert({
        name: payload.name.trim(),
        source_type: payload.source_type ?? 'upload',
        effective_date: payload.effective_date ?? null,
        expiration_date: payload.expiration_date ?? null,
        investor_code: payload.investor_code ?? null,
        created_at: now,
        metadata: {
          uploaded_via: 'edge_function',
          columns_hint:
            'Product, Loan Type, Rate, Price, Min FICO, Max LTV, State, Min Loan, Max Loan, Occupancy Filter, Purpose Filter, Property Filter, Adjustments (JSON)',
        },
      })
      .select('*')
      .single();

    if (insertError || !rateSheet) {
      console.error('Failed to insert rate_sheets:', insertError);
      return jsonResponse({ error: 'Failed to create rate sheet' }, 500);
    }

    const products = tableRows
      .map((row) => {
        const rec = row as unknown as Record<string, unknown>;
        const product = normKey(rec, 'Product', 'product', 'product_name');
        const loanType = normKey(rec, 'Loan Type', 'loan_type');
        const rate = Number(normKey(rec, 'Rate', 'rate') || 0);
        const priceRaw = normKey(rec, 'Price', 'price');
        const price = priceRaw !== '' ? Number(priceRaw) : null;
        const minFico = normKey(rec, 'Min FICO', 'min_fico', 'MinFICO');
        const maxLtv = normKey(rec, 'Max LTV', 'max_ltv', 'MaxLTV');
        const state = normKey(rec, 'State', 'state') || 'ALL';
        const minLoan = normKey(rec, 'Min Loan', 'min_loan_amount');
        const maxLoan = normKey(rec, 'Max Loan', 'max_loan_amount');
        const occF = normKey(rec, 'Occupancy Filter', 'occupancy_filter');
        const purF = normKey(rec, 'Purpose Filter', 'purpose_filter');
        const propF = normKey(rec, 'Property Filter', 'property_type_filter', 'Property Filter');
        let adjustments: unknown = [];
        const adjRaw = normKey(rec, 'Adjustments', 'adjustments');
        if (adjRaw) {
          try {
            adjustments = JSON.parse(adjRaw);
          } catch {
            adjustments = [];
          }
        }

        return {
          rate_sheet_id: rateSheet.id,
          product_name: product,
          loan_type: loanType || null,
          rate: isFinite(rate) ? rate : null,
          price: price != null && isFinite(price) ? price : null,
          min_credit_score: minFico !== '' ? Number(minFico) : null,
          max_ltv: maxLtv !== '' ? Number(maxLtv) : null,
          min_loan_amount: minLoan !== '' ? Number(minLoan) : null,
          max_loan_amount: maxLoan !== '' ? Number(maxLoan) : null,
          state: state || 'ALL',
          occupancy_filter: splitList(occF),
          purpose_filter: splitList(purF),
          property_type_filter: splitList(propF),
          adjustments: Array.isArray(adjustments) ? adjustments : [],
        };
      })
      .filter((p) => p.product_name && p.rate !== null);

    if (products.length > 0) {
      const chunks: typeof products[] = [];
      const size = 500;
      for (let i = 0; i < products.length; i += size) {
        chunks.push(products.slice(i, i + size));
      }

      for (const chunk of chunks) {
        const { error } = await supabase.from('rate_sheet_products').insert(chunk);
        if (error) {
          console.error('Failed to insert rate_sheet_products chunk:', error);
          await supabase.from('rate_sheet_products').delete().eq('rate_sheet_id', rateSheet.id);
          await supabase.from('rate_sheets').delete().eq('id', rateSheet.id);
          return jsonResponse({
            error: 'Failed to insert rate sheet products; upload rolled back',
          }, 500);
        }
      }
    }

    return jsonResponse({
      rate_sheet: rateSheet,
      products_inserted: products.length,
    });
  } catch (err) {
    console.error('pricing-rate-sheets-upload error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
