/**
 * Validated CSV import for loans (dry-run or commit). Upsert by data_source + external_id.
 * Requires admin app role or loans:import permission. Uses service role after authorization.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_ROWS = 200;
const ALLOWED_STATUS = new Set(['draft', 'application', 'processing', 'approved', 'closed']);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
      if (c === '\r') i++;
      row.push(cur);
      cur = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else if (c === '\r') {
      row.push(cur);
      cur = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

async function userMayImportCsv(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data: urList } = await supabase.from('user_roles').select('role, custom_role_id').eq('user_id', userId);
  if ((urList ?? []).some((r: { role: string }) => r.role === 'admin')) return true;
  const rowWithCustom = (urList ?? []).find((r: { custom_role_id: string | null }) => r.custom_role_id);
  if (rowWithCustom?.custom_role_id) {
    const { data: role } = await supabase
      .from('roles')
      .select('permissions')
      .eq('id', rowWithCustom.custom_role_id)
      .maybeSingle();
    const perms = role?.permissions as string[] | null;
    if (Array.isArray(perms) && perms.includes('loans:import')) return true;
  }
  const { data: ups } = await supabase
    .from('user_permission_settings')
    .select('permissions')
    .eq('user_id', userId)
    .maybeSingle();
  const p = ups?.permissions as string[] | null;
  return Array.isArray(p) && p.includes('loans:import');
}

interface ParsedRow {
  line: number;
  loan_number: string;
  external_id: string;
  data_source: string;
  borrower_id: string;
  loan_officer_id: string;
  status: string;
  loan_amount: number | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_postal_code: string | null;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const svc = createClient(supabaseUrl, serviceRoleKey);
    const allowed = await userMayImportCsv(svc, user.id);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: requires admin role or loans:import permission.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      csv_text?: string;
      dry_run?: boolean;
    };

    const csvText = typeof body.csv_text === 'string' ? body.csv_text : '';
    const dryRun = body.dry_run !== false;

    if (!csvText.trim()) {
      return new Response(JSON.stringify({ error: 'csv_text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const grid = parseCsv(csvText.trim());
    if (grid.length < 2) {
      return new Response(JSON.stringify({ error: 'CSV must include a header row and at least one data row.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headerCells = grid[0].map(normalizeHeader);
    const col = (name: string) => headerCells.indexOf(name);
    const reqCols = ['loan_number', 'external_id', 'data_source', 'borrower_id', 'loan_officer_id', 'status'];
    for (const c of reqCols) {
      if (col(c) < 0) {
        return new Response(
          JSON.stringify({
            error: `Missing required column: ${c}`,
            hint: 'Expected header: loan_number,external_id,data_source,borrower_id,loan_officer_id,status,loan_amount,property_address,property_city,property_state,property_postal_code',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const dataRows = grid.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
    if (dataRows.length > MAX_ROWS) {
      return new Response(JSON.stringify({ error: `Too many rows (max ${MAX_ROWS})` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const errors: { line: number; message: string }[] = [];
    const parsed: ParsedRow[] = [];

    const idxLoanAmt = col('loan_amount');
    const idxAddr = col('property_address');
    const idxCity = col('property_city');
    const idxState = col('property_state');
    const idxZip = col('property_postal_code');

    for (let i = 0; i < dataRows.length; i++) {
      const line = i + 2;
      const r = dataRows[i];
      const get = (name: string) => {
        const j = col(name);
        return j >= 0 && r[j] !== undefined ? String(r[j]).trim() : '';
      };

      const loan_number = get('loan_number');
      const external_id = get('external_id');
      const data_source = get('data_source') || 'csv_import';
      const borrower_id = get('borrower_id');
      const loan_officer_id = get('loan_officer_id');
      const status = get('status') || 'draft';

      if (!loan_number) {
        errors.push({ line, message: 'loan_number is required' });
        continue;
      }
      if (!external_id) {
        errors.push({ line, message: 'external_id is required for upsert key' });
        continue;
      }
      if (!UUID_RE.test(borrower_id)) {
        errors.push({ line, message: 'borrower_id must be a valid UUID' });
        continue;
      }
      if (!UUID_RE.test(loan_officer_id)) {
        errors.push({ line, message: 'loan_officer_id must be a valid UUID' });
        continue;
      }
      if (!ALLOWED_STATUS.has(status)) {
        errors.push({ line, message: `status must be one of: ${[...ALLOWED_STATUS].join(', ')}` });
        continue;
      }

      let loan_amount: number | null = null;
      if (idxLoanAmt >= 0 && r[idxLoanAmt]?.trim()) {
        const n = Number(r[idxLoanAmt].replace(/,/g, ''));
        if (Number.isNaN(n)) {
          errors.push({ line, message: 'loan_amount must be a number' });
          continue;
        }
        loan_amount = n;
      }

      parsed.push({
        line,
        loan_number,
        external_id,
        data_source,
        borrower_id,
        loan_officer_id,
        status,
        loan_amount,
        property_address: idxAddr >= 0 && r[idxAddr]?.trim() ? r[idxAddr].trim() : null,
        property_city: idxCity >= 0 && r[idxCity]?.trim() ? r[idxCity].trim() : null,
        property_state: idxState >= 0 && r[idxState]?.trim() ? r[idxState].trim() : null,
        property_postal_code: idxZip >= 0 && r[idxZip]?.trim() ? r[idxZip].trim() : null,
      });
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ dry_run: true, errors, imported: 0, updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Existence checks: borrowers + officers
    for (const p of parsed) {
      const { data: b } = await svc.from('borrowers').select('id').eq('id', p.borrower_id).maybeSingle();
      if (!b) {
        errors.push({ line: p.line, message: `borrower_id not found: ${p.borrower_id}` });
      }
      const { data: o } = await svc.from('profiles').select('id').eq('id', p.loan_officer_id).maybeSingle();
      if (!o) {
        errors.push({ line: p.line, message: `loan_officer_id not found in profiles: ${p.loan_officer_id}` });
      }
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ dry_run: true, errors, imported: 0, updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          errors: [],
          valid_rows: parsed.length,
          message: 'Validation passed. Set dry_run=false to apply.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let imported = 0;
    let updated = 0;

    for (const p of parsed) {
      const { data: officerProfile } = await svc
        .from('profiles')
        .select('branch_id')
        .eq('id', p.loan_officer_id)
        .maybeSingle();

      const { data: existing } = await svc
        .from('loans')
        .select('id')
        .eq('data_source', p.data_source)
        .eq('external_id', p.external_id)
        .maybeSingle();

      const payload = {
        loan_number: p.loan_number,
        borrower_id: p.borrower_id,
        loan_officer_id: p.loan_officer_id,
        branch_id: officerProfile?.branch_id ?? null,
        status: p.status,
        loan_amount: p.loan_amount,
        property_address: p.property_address,
        property_city: p.property_city,
        property_state: p.property_state,
        property_postal_code: p.property_postal_code,
        data_source: p.data_source,
        external_id: p.external_id,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { error: upErr } = await svc.from('loans').update(payload).eq('id', existing.id);
        if (upErr) {
          errors.push({ line: p.line, message: upErr.message });
        } else {
          updated += 1;
        }
      } else {
        const { error: insErr } = await svc.from('loans').insert({
          ...payload,
          created_by: user.id,
        });
        if (insErr) {
          errors.push({ line: p.line, message: insErr.message });
        } else {
          imported += 1;
        }
      }
    }

    return new Response(
      JSON.stringify({
        dry_run: false,
        errors,
        imported,
        updated,
        failed: errors.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
