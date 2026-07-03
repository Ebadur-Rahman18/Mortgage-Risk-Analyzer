/**
 * pricing-calculate — single-file bundle for Supabase (dashboard or CLI).
 * Eligibility / LLPA / lock helpers are inlined so no sibling `_shared` imports are required.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Inlined from former `_shared/pricing-eligibility.ts` ─────────────────

interface PricingInput {
  loan_amount: number;
  property_value?: number;
  ltv?: number;
  credit_score: number;
  state: string;
}

interface PricingScenarioDims {
  occupancy?: string | null;
  purpose?: string | null;
  property_type?: string | null;
  first_time_homebuyer?: boolean | null;
  subordinate_financing?: boolean | null;
}

const OCC_MAP: Record<string, string> = {
  primary: 'primary',
  secondhome: 'second_home',
  second_home: 'second_home',
  investment: 'investment',
};

const PURPOSE_MAP: Record<string, string> = {
  purchase: 'purchase',
  refinance: 'rate_term_refinance',
  ratetermrefinance: 'rate_term_refinance',
  rate_term_refinance: 'rate_term_refinance',
  cashoutrefinance: 'cash_out_refinance',
  cash_out_refinance: 'cash_out_refinance',
  construction: 'purchase',
};

const PROP_MAP: Record<string, string> = {
  sfr: 'sfr',
  condo: 'condo',
  twotofourunit: 'two_to_four_unit',
  '2-4_unit': 'two_to_four_unit',
  two_to_four_unit: 'two_to_four_unit',
};

function normalizeOccupancy(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const k = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '');
  return OCC_MAP[k] ?? k;
}

function normalizePurpose(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const k = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '');
  return PURPOSE_MAP[k] ?? k;
}

function normalizePropertyType(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const k = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '').replace('to', 'to');
  const simple = k.replace(/[^a-z0-9]/g, '');
  if (simple === 'condo') return 'condo';
  if (simple.includes('24') || simple.includes('twotofour')) return 'two_to_four_unit';
  return PROP_MAP[simple] ?? (simple === 'singlefamily' || simple === 'sfr' ? 'sfr' : simple);
}

function matchesScenarioFilters(
  occupancyFilter: string[] | null | undefined,
  purposeFilter: string[] | null | undefined,
  propertyFilter: string[] | null | undefined,
  scenario: PricingScenarioDims,
): boolean {
  const occ = scenario.occupancy ?? null;
  const pur = scenario.purpose ?? null;
  const prop = scenario.property_type ?? null;

  if (occupancyFilter && occupancyFilter.length > 0) {
    const allowed = occupancyFilter.map((x) => String(x).toLowerCase());
    if (!occ || !allowed.includes(occ)) return false;
  }
  if (purposeFilter && purposeFilter.length > 0) {
    const allowed = purposeFilter.map((x) => String(x).toLowerCase());
    if (!pur || !allowed.includes(pur)) return false;
  }
  if (propertyFilter && propertyFilter.length > 0) {
    const allowed = propertyFilter.map((x) => String(x).toLowerCase());
    if (!prop || !allowed.includes(prop)) return false;
  }
  return true;
}

interface LlpaWhen {
  occupancy?: string;
  purpose?: string;
  property_type?: string;
}

interface LlpaRule {
  when?: LlpaWhen;
  add_rate_bps?: number;
  add_price?: number;
}

function applyLlpaAdjustments(
  baseRate: number,
  basePrice: number | null,
  scenario: PricingScenarioDims,
  adjustments: unknown,
): { rate: number; price: number | null } {
  let rate = baseRate;
  let price = basePrice;
  if (!Array.isArray(adjustments)) {
    return { rate, price };
  }

  for (const raw of adjustments as LlpaRule[]) {
    const when = raw?.when;
    if (!when || Object.keys(when).length === 0) {
      /* unconditional */
    } else {
      if (when.occupancy) {
        const w = String(when.occupancy).toLowerCase();
        if ((scenario.occupancy ?? '') !== w) continue;
      }
      if (when.purpose) {
        const w = String(when.purpose).toLowerCase();
        if ((scenario.purpose ?? '') !== w) continue;
      }
      if (when.property_type) {
        const w = String(when.property_type).toLowerCase();
        if ((scenario.property_type ?? '') !== w) continue;
      }
    }
    const bps = raw.add_rate_bps ?? 0;
    rate += bps / 10000;
    if (price != null && raw.add_price != null) {
      price += Number(raw.add_price);
    }
  }

  return {
    rate: +rate.toFixed(4),
    price: price != null ? +price.toFixed(4) : null,
  };
}

interface ProductRow {
  product_name: string;
  min_fico?: number | null;
  max_ltv?: number | null;
  min_loan_amount?: number | null;
  max_loan_amount?: number | null;
  allowed_states?: string[] | null;
  additional_conditions?: Record<string, unknown> | null;
}

type EligibilityStatus = 'Eligible' | 'Not Eligible' | 'EligibleWithConditions';

interface EligibilityResult {
  status: EligibilityStatus;
  message: string;
}

function evaluateEligibility(product: ProductRow, input: PricingInput): EligibilityResult {
  const reasons: string[] = [];

  if (product.min_fico != null && input.credit_score < product.min_fico) {
    reasons.push('FICO below minimum');
  }

  const ltv =
    input.ltv ??
    (input.property_value ? (input.loan_amount / input.property_value) * 100 : undefined);
  if (ltv != null && product.max_ltv != null && ltv > Number(product.max_ltv)) {
    reasons.push('LTV above maximum');
  }

  if (product.min_loan_amount != null && input.loan_amount < product.min_loan_amount) {
    reasons.push('Loan amount below minimum');
  }
  if (product.max_loan_amount != null && input.loan_amount > product.max_loan_amount) {
    reasons.push('Loan amount above maximum');
  }

  if (product.allowed_states && product.allowed_states.length > 0) {
    const allowed = product.allowed_states.map((s) => s.toUpperCase());
    if (!allowed.includes(input.state.toUpperCase())) {
      reasons.push('State not allowed');
    }
  }

  if (reasons.length > 0) {
    return {
      status: 'Not Eligible',
      message: `Not Eligible – ${reasons.join('; ')}`,
    };
  }

  const conditions = product.additional_conditions as
    | { note?: string; requires_min_down?: number }
    | null
    | undefined;

  if (conditions && (conditions.note || conditions.requires_min_down != null)) {
    const parts: string[] = [];
    if (conditions.requires_min_down != null) {
      const pct = Math.round(conditions.requires_min_down * 100);
      parts.push(`Requires ${pct}% down`);
    }
    if (conditions.note) {
      parts.push(conditions.note);
    }

    return {
      status: 'EligibleWithConditions',
      message: `Eligible – ${parts.join('. ')}`,
    };
  }

  return {
    status: 'Eligible',
    message: 'Eligible',
  };
}

function applyLockTermAdjustments(
  baseRate: number,
  basePrice: number | null | undefined,
  lockTermDays?: number,
): { adjustedRate: number; adjustedPrice: number | null } {
  if (!lockTermDays) {
    return { adjustedRate: baseRate, adjustedPrice: basePrice ?? null };
  }

  let rateDelta = 0;
  if (lockTermDays <= 30) {
    rateDelta = 0;
  } else if (lockTermDays <= 45) {
    rateDelta = 0.05 / 100;
  } else if (lockTermDays <= 60) {
    rateDelta = 0.125 / 100;
  } else {
    rateDelta = 0.25 / 100;
  }

  const adjustedRate = +(baseRate + rateDelta).toFixed(4);

  let adjustedPrice = basePrice ?? null;
  if (basePrice != null) {
    let priceDelta = 0;
    if (lockTermDays > 30 && lockTermDays <= 45) {
      priceDelta = -0.05;
    } else if (lockTermDays > 45 && lockTermDays <= 60) {
      priceDelta = -0.125;
    } else if (lockTermDays > 60) {
      priceDelta = -0.25;
    }
    adjustedPrice = +(basePrice + priceDelta).toFixed(4);
  }

  return { adjustedRate, adjustedPrice };
}

// ─── HTTP handler ─────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PricingRequest {
  loan_amount: number;
  property_value?: number;
  credit_score: number;
  state: string;
  product_type?: string;
  lock_term_days?: number;
  loan_id?: string;
  simulate_terms?: number[];
  user_id?: string;
  include_ineligible?: boolean;
  occupancy_type?: string | null;
  purpose?: string | null;
  property_type?: string | null;
  first_time_homebuyer?: boolean | null;
  subordinate_financing?: boolean | null;
  investor_code?: string | null;
  rate_sheet_id?: string | null;
  best_execution?: boolean;
}

interface RateSheetRow {
  id: string;
  name: string;
  effective_date: string | null;
  expiration_date: string | null;
  investor_code?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface RateSheetProductRow {
  id?: string;
  product_name: string;
  loan_type: string | null;
  min_credit_score: number | null;
  max_ltv: number | null;
  min_loan_amount: number | null;
  max_loan_amount: number | null;
  state: string;
  rate: number;
  price: number | null;
  occupancy_filter?: string[] | null;
  purpose_filter?: string[] | null;
  property_type_filter?: string[] | null;
  adjustments?: unknown;
}

interface PricingResultRow {
  rate_sheet_id: string;
  rate_sheet_name?: string;
  investor_code?: string | null;
  product_name: string;
  loan_type: string | null;
  state: string;
  base_rate: number;
  base_price: number | null;
  adjusted_rate: number;
  adjusted_price: number | null;
  eligibility_status: EligibilityStatus;
  eligibility_message: string;
  quote_type: string;
  simulations: Array<{
    lock_term_days: number;
    est_rate: number;
    est_price: number | null;
  }>;
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

function normalizeState(input: string): string {
  const raw = (input ?? '').trim().toUpperCase();
  if (!raw) return raw;

  const alphaOnly = raw.replace(/[^A-Z\s]/g, '');
  if (alphaOnly.length === 2 && US_STATE_CODES.has(alphaOnly)) return alphaOnly;

  const words = alphaOnly.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = `${words[0][0]}${words[1][0]}`;
    if (US_STATE_CODES.has(initials)) return initials;
  }

  return alphaOnly;
}

function isWithinDateWindow(
  effectiveDate: string | null | undefined,
  expirationDate: string | null | undefined,
  today: string,
): boolean {
  const effOk = !effectiveDate || effectiveDate <= today;
  const expOk = !expirationDate || expirationDate >= today;
  return effOk && expOk;
}

function sheetQuoteType(sheet: RateSheetRow): string {
  const m = sheet.metadata as { quote_type?: string } | null | undefined;
  const qt = m?.quote_type;
  if (qt === 'lock_eligible') return 'lock_eligible';
  return 'indicative';
}

function buildScenario(body: PricingRequest, loanRow: Record<string, unknown> | null): PricingScenarioDims {
  const occ = normalizeOccupancy(
    body.occupancy_type ?? (loanRow?.occupancy_type as string | undefined) ?? undefined,
  );
  const pur = normalizePurpose(body.purpose ?? (loanRow?.purpose as string | undefined) ?? undefined);
  const prop = normalizePropertyType(body.property_type ?? undefined);
  return {
    occupancy: occ,
    purpose: pur,
    property_type: prop,
    first_time_homebuyer: body.first_time_homebuyer ?? null,
    subordinate_financing: body.subordinate_financing ?? null,
  };
}

function mapProductsToResults(
  activeSheet: RateSheetRow,
  typedProducts: RateSheetProductRow[],
  body: PricingRequest,
  pricingInput: PricingInput,
  scenario: PricingScenarioDims,
  simulateTerms: number[],
  includeIneligible: boolean,
): PricingResultRow[] {
  const qt = sheetQuoteType(activeSheet);
  return typedProducts
    .filter((p) => {
      if (body.product_type && p.loan_type) {
        const requested = body.product_type.trim().toUpperCase();
        const productLoanType = String(p.loan_type).trim().toUpperCase();
        if (requested !== productLoanType) return false;
      }
      return matchesScenarioFilters(
        p.occupancy_filter ?? null,
        p.purpose_filter ?? null,
        p.property_type_filter ?? null,
        scenario,
      );
    })
    .map((p) => {
      let allowedStates: string[] | null = null;
      if (p.state && p.state !== 'ALL') {
        allowedStates = String(p.state)
          .split(/[,\s|/]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
      }

      const rule: ProductRow = {
        product_name: p.product_name,
        min_fico: p.min_credit_score,
        max_ltv: p.max_ltv,
        min_loan_amount: p.min_loan_amount,
        max_loan_amount: p.max_loan_amount,
        allowed_states: allowedStates,
        additional_conditions: null,
      };

      const eligibility = evaluateEligibility(rule, pricingInput);
      const baseRate = Number(p.rate);
      const basePrice = p.price != null ? Number(p.price) : null;
      const llpa = applyLlpaAdjustments(baseRate, basePrice, scenario, p.adjustments ?? []);
      const baseAdjusted = applyLockTermAdjustments(llpa.rate, llpa.price, body.lock_term_days);

      const simulations = simulateTerms.map((term) => {
        const afterLlpa = applyLlpaAdjustments(baseRate, basePrice, scenario, p.adjustments ?? []);
        const adj = applyLockTermAdjustments(afterLlpa.rate, afterLlpa.price, term);
        return {
          lock_term_days: term,
          est_rate: adj.adjustedRate,
          est_price: adj.adjustedPrice,
        };
      });

      return {
        rate_sheet_id: activeSheet.id,
        rate_sheet_name: activeSheet.name,
        investor_code: activeSheet.investor_code ?? null,
        product_name: p.product_name,
        loan_type: p.loan_type,
        state: p.state,
        base_rate: baseRate,
        base_price: basePrice,
        adjusted_rate: baseAdjusted.adjustedRate,
        adjusted_price: baseAdjusted.adjustedPrice,
        eligibility_status: eligibility.status,
        eligibility_message: eligibility.message,
        quote_type: qt,
        simulations,
      };
    })
    .filter((result) => {
      if (includeIneligible) return true;
      return result.eligibility_status !== 'Not Eligible';
    })
    .sort((a, b) => {
      const rank = (status: string) =>
        status === 'Eligible' ? 0 : status === 'EligibleWithConditions' ? 1 : 2;
      const statusCmp = rank(a.eligibility_status) - rank(b.eligibility_status);
      if (statusCmp !== 0) return statusCmp;
      return a.adjusted_rate - b.adjusted_rate;
    });
}

function mergeBestExecution(rows: PricingResultRow[]): PricingResultRow[] {
  const eligible = rows.filter((r) => r.eligibility_status !== 'Not Eligible');
  const ineligible = rows.filter((r) => r.eligibility_status === 'Not Eligible');
  const map = new Map<string, PricingResultRow>();
  for (const r of eligible) {
    const k = `${r.product_name}|${r.loan_type ?? ''}|${r.state}`;
    const prev = map.get(k);
    if (!prev || r.adjusted_rate < prev.adjusted_rate) map.set(k, r);
  }
  const out = [...map.values(), ...ineligible];
  return out.sort((a, b) => {
    const rank = (status: string) =>
      status === 'Eligible' ? 0 : status === 'EligibleWithConditions' ? 1 : 2;
    const statusCmp = rank(a.eligibility_status) - rank(b.eligibility_status);
    if (statusCmp !== 0) return statusCmp;
    return a.adjusted_rate - b.adjusted_rate;
  });
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

    const body = (await req.json().catch(() => ({}))) as PricingRequest;
    if (!body.loan_amount || !body.credit_score || !body.state) {
      return new Response(
        JSON.stringify({ error: 'loan_amount, credit_score, and state are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    if (body.lock_term_days != null && Number(body.lock_term_days) <= 0) {
      return new Response(
        JSON.stringify({ error: 'lock_term_days must be greater than 0' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    if (body.investor_code && !/^[A-Za-z0-9_-]{2,40}$/.test(body.investor_code.trim())) {
      return new Response(
        JSON.stringify({ error: 'investor_code format is invalid' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    let loanRow: Record<string, unknown> | null = null;
    if (body.loan_id) {
      const { data: loan } = await supabase
        .from('loans')
        .select(
          'id, loan_amount, appraised_value, ltv, credit_score, property_state, occupancy_type, purpose',
        )
        .eq('id', body.loan_id)
        .maybeSingle();
      loanRow = (loan ?? null) as Record<string, unknown> | null;
    }

    let ltvPct: number | undefined;
    if (body.property_value && body.property_value > 0) {
      ltvPct = (body.loan_amount / body.property_value) * 100;
    } else if (loanRow) {
      const la = Number(loanRow.loan_amount ?? body.loan_amount ?? 0);
      const av = Number(loanRow.appraised_value ?? 0);
      if (av > 0) ltvPct = (la / av) * 100;
      else if (loanRow.ltv != null) {
        const lv = Number(loanRow.ltv);
        ltvPct = lv <= 1 ? lv * 100 : lv;
      }
    }

    const normalizedState = normalizeState(
      body.state || String(loanRow?.property_state ?? ''),
    );
    if (!US_STATE_CODES.has(normalizedState)) {
      return new Response(
        JSON.stringify({ error: `Unsupported state code: ${body.state}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    const pricingInput: PricingInput = {
      loan_amount: body.loan_amount,
      property_value: body.property_value,
      ltv: ltvPct,
      credit_score: body.credit_score,
      state: normalizedState || body.state || String(loanRow?.property_state ?? ''),
    };

    const scenario = buildScenario(body, loanRow);

    const today = new Date().toISOString().slice(0, 10);
    const { data: activeSheetsRaw, error: rsError } = await supabase
      .from('rate_sheets')
      .select('*')
      .eq('status', 'active')
      .order('effective_date', { ascending: false })
      .limit(50);

    if (rsError) {
      console.error('Failed to load active rate sheets:', rsError);
      return new Response(JSON.stringify({ error: 'Failed to load active rate sheets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let typedSheets = ((activeSheetsRaw ?? []) as RateSheetRow[]).filter((sheet) =>
      isWithinDateWindow(sheet.effective_date, sheet.expiration_date, today),
    );

    if (body.rate_sheet_id) {
      typedSheets = typedSheets.filter((s) => s.id === body.rate_sheet_id);
    } else if (body.investor_code?.trim()) {
      const ic = body.investor_code.trim().toUpperCase();
      typedSheets = typedSheets.filter(
        (s) => (s.investor_code ?? '').toUpperCase() === ic,
      );
    }

    if (typedSheets.length === 0) {
      return new Response(JSON.stringify({ error: 'No active rate sheet found for this filter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const simulateTerms =
      body.simulate_terms && body.simulate_terms.length > 0
        ? body.simulate_terms
        : [30, 45, 60];

    const includeIneligible = body.include_ineligible ?? true;
    let results: PricingResultRow[] = [];
    let primarySheet: RateSheetRow = typedSheets[0];

    if (body.best_execution) {
      for (const sheet of typedSheets) {
        const { data: products, error: productsErr } = await supabase
          .from('rate_sheet_products')
          .select('*')
          .eq('rate_sheet_id', sheet.id);
        if (productsErr) {
          console.error('Failed to load rate sheet products:', productsErr);
          return new Response(JSON.stringify({ error: 'Failed to load rate sheet products' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const typedProducts = (products ?? []) as RateSheetProductRow[];
        results.push(
          ...mapProductsToResults(
            sheet,
            typedProducts,
            body,
            pricingInput,
            scenario,
            simulateTerms,
            includeIneligible,
          ),
        );
      }
      results = mergeBestExecution(results);
    } else {
      primarySheet = typedSheets[0];
      const { data: products, error: prodError } = await supabase
        .from('rate_sheet_products')
        .select('*')
        .eq('rate_sheet_id', primarySheet.id);

      if (prodError) {
        console.error('Failed to load rate sheet products:', prodError);
        return new Response(JSON.stringify({ error: 'Failed to load rate sheet products' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const typedProducts = (products ?? []) as RateSheetProductRow[];
      results = mapProductsToResults(
        primarySheet,
        typedProducts,
        body,
        pricingInput,
        scenario,
        simulateTerms,
        includeIneligible,
      );
    }

    const eligibleCount = results.filter((r) => r.eligibility_status !== 'Not Eligible').length;
    const ineligibleCount = results.length - eligibleCount;
    const bestMatch = results.find((r) => r.eligibility_status !== 'Not Eligible') ?? results[0];

    const response: Record<string, unknown> = {
      rate_sheet: primarySheet,
      rate_sheets_considered: typedSheets.map((s) => ({ id: s.id, name: s.name, investor_code: s.investor_code })),
      results,
      scenario_dims: scenario,
      diagnostics: {
        normalized_state: pricingInput.state,
        active_rate_sheet_name: primarySheet.name,
        total_products_considered: results.length,
        considered_products: results.length,
        eligible_products: eligibleCount,
        ineligible_products: ineligibleCount,
        best_execution: !!body.best_execution,
      },
    };

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          ...response,
          message: 'No products found for this scenario. Check product type, scenario filters, and rate sheet contents.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const userId = body.user_id ?? null;
    if (userId) {
      await supabase.from('loan_pricing_calculations').insert({
        user_id: userId,
        loan_id: body.loan_id ?? null,
        loan_amount: body.loan_amount,
        property_value: body.property_value ?? null,
        ltv: pricingInput.ltv ?? null,
        credit_score: body.credit_score,
        state: pricingInput.state,
        product_selected: bestMatch?.product_name ?? null,
        lock_term_days: body.lock_term_days ?? null,
        calculated_rate: bestMatch?.adjusted_rate ?? null,
        calculated_price: bestMatch?.adjusted_price ?? null,
        eligibility_status: bestMatch?.eligibility_status ?? null,
        conditions_text: bestMatch?.eligibility_message ?? null,
        raw_match_metadata: {
          sheet_id: primarySheet.id,
          total_matches: results.length,
          investor_code: body.investor_code ?? null,
          best_execution: !!body.best_execution,
        },
      });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('pricing-calculate error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
