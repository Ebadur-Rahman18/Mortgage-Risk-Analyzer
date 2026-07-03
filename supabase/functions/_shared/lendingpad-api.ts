/**
 * LendingPad API helpers. Paths and hosts are contract-specific; set api_base_url + loans_list_path in integration_settings.config.
 * See: https://www.lendingpad.com (API terms require an agreement — defaults are common REST shapes).
 */

export function normalizeBaseUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  return t.startsWith('http') ? t : `https://${t}`;
}

export function extractLoanArray(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) {
    return json.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');
  }
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    const candidates = [o.data, o.loans, o.results, o.items, o.records];
    for (const c of candidates) {
      if (Array.isArray(c)) {
        return c.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');
      }
    }
  }
  return [];
}

export function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v.replace(/[^0-9.-]/g, ''));
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

/** Map vendor status strings to our loans.status CHECK-friendly values */
export function normalizeLoanStatus(raw: string): string {
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  const allowed = new Set([
    'draft',
    'submitted',
    'processing',
    'underwriting',
    'approved',
    'clear_to_close',
    'closed',
    'denied',
    'withdrawn',
  ]);
  if (allowed.has(s)) return s;
  if (s.includes('close') && s.includes('clear')) return 'clear_to_close';
  if (s.includes('fund') || s.includes('closed')) return 'closed';
  if (s.includes('approve')) return 'approved';
  if (s.includes('underwrit')) return 'underwriting';
  if (s.includes('process')) return 'processing';
  if (s.includes('submit')) return 'submitted';
  if (s.includes('denied') || s.includes('declin')) return 'denied';
  if (s.includes('withdraw')) return 'withdrawn';
  return 'processing';
}
