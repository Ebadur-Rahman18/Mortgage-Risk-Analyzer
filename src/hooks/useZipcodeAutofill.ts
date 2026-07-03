import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type ZipcodeAutofillResult = {
  zip: string;
  city: string;
  state: string;
} | null;

type ColumnConfig = {
  zipCol: string;
  cityCol: string;
  stateCol: string;
};

/**
 * Hook for looking up US ZIP code data from the all_US_zipcode table.
 *
 * Supports three lookup directions:
 *   - by ZIP  → returns city + state
 *   - by city → returns ZIP + state (first match)
 *   - by state abbreviation → not used for autofill (too many matches)
 */
export function useZipcodeAutofill() {
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const TABLE_CANDIDATES = ["all_US_zipcode", "all_us_zipcode"] as const;

  // Try common column-name variants so this keeps working even if the table was
  // created outside migrations and types weren't regenerated.
  const COLUMN_CONFIGS: ColumnConfig[] = [
    { zipCol: "zip_code", cityCol: "usps_default_city", stateCol: "usps_default_state" },
    { zipCol: "zip", cityCol: "city", stateCol: "state_id" },
    { zipCol: "zip", cityCol: "city", stateCol: "state" },
    { zipCol: "zip_code", cityCol: "city", stateCol: "state_id" },
    { zipCol: "zip_code", cityCol: "city", stateCol: "state" },
    { zipCol: "zipcode", cityCol: "city", stateCol: "state" },
    { zipCol: "postal_code", cityCol: "city", stateCol: "state" },
    { zipCol: "postal_code", cityCol: "place", stateCol: "state" },
    { zipCol: "zip", cityCol: "primary_city", stateCol: "state_abbr" },
  ];

  const clearDebounce = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const selectFromZipTable = async (tableSelect: (tableName: string) => Promise<any>) => {
    let lastError: any = null;
    for (const tableName of TABLE_CANDIDATES) {
      const { data, error } = await tableSelect(tableName);
      if (!error) return { data, error: null };
      lastError = error;
      const msg = String(error?.message ?? "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("not found")) continue;
    }
    return { data: null, error: lastError ?? new Error("Failed to query zipcode table") };
  };

  const normalizeRecord = (data: any, cfg: ColumnConfig): ZipcodeAutofillResult => {
    if (!data) return null;
    const zipRaw = data[cfg.zipCol];
    const zip =
      typeof zipRaw === "number" || typeof zipRaw === "bigint"
        ? String(zipRaw).padStart(5, "0")
        : String(zipRaw ?? "").trim();
    const city = String(data[cfg.cityCol] ?? "").trim();
    const stateRaw = String(data[cfg.stateCol] ?? "").trim();
    const state = stateRaw.toUpperCase();
    if (!zip || !city || state.length !== 2) return null;
    return { zip, city, state };
  };

  /** Look up by 5-digit ZIP code. Returns city + state on match. */
  const lookupByZip = useCallback(
    async (zip: string): Promise<ZipcodeAutofillResult> => {
      const clean = zip.trim();
      if (!/^\d{5}$/.test(clean)) return null;

      setLoading(true);
      try {
        for (const cfg of COLUMN_CONFIGS) {
          const select = `${cfg.zipCol}, ${cfg.cityCol}, ${cfg.stateCol}`;
          const zipValue =
            cfg.zipCol === "zip_code"
              ? Number.parseInt(clean, 10)
              : clean;
          const { data, error } = await selectFromZipTable((tableName) =>
            (supabase as any)
              .from(tableName)
              .select(select)
              .eq(cfg.zipCol, zipValue)
              .limit(1)
              .maybeSingle(),
          );

          if (error) continue;
          const normalized = normalizeRecord(data, cfg);
          if (normalized) return normalized;
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /** Look up by city name (case-insensitive prefix). Returns ZIP + state of the first match. */
  const lookupByCity = useCallback(
    async (city: string): Promise<ZipcodeAutofillResult> => {
      const clean = city.trim();
      if (clean.length < 2) return null;

      setLoading(true);
      try {
        for (const cfg of COLUMN_CONFIGS) {
          const select = `${cfg.zipCol}, ${cfg.cityCol}, ${cfg.stateCol}`;
          const { data, error } = await selectFromZipTable((tableName) =>
            (supabase as any)
              .from(tableName)
              .select(select)
              .ilike(cfg.cityCol, clean)
              .limit(1)
              .maybeSingle(),
          );

          if (error) continue;
          const normalized = normalizeRecord(data, cfg);
          if (normalized) return normalized;
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /** Look up by city + state abbreviation (exact state, case-insensitive city). Prefer this for autofill. */
  const lookupByCityState = useCallback(
    async (city: string, state: string): Promise<ZipcodeAutofillResult> => {
      const cityClean = city.trim();
      const stateClean = state.trim().toUpperCase();
      if (cityClean.length < 2 || stateClean.length !== 2) return null;

      setLoading(true);
      try {
        for (const cfg of COLUMN_CONFIGS) {
          const select = `${cfg.zipCol}, ${cfg.cityCol}, ${cfg.stateCol}`;
          const { data, error } = await selectFromZipTable((tableName) =>
            (supabase as any)
              .from(tableName)
              .select(select)
              .eq(cfg.stateCol, stateClean)
              .ilike(cfg.cityCol, cityClean)
              .order(cfg.zipCol, { ascending: true })
              .limit(1)
              .maybeSingle(),
          );

          if (error) continue;
          const normalized = normalizeRecord(data, cfg);
          if (normalized) return normalized;
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /** Look up by 2-letter state abbreviation + city to narrow the result. */
  const lookupByState = useCallback(
    async (state: string): Promise<ZipcodeAutofillResult> => {
      const clean = state.trim().toUpperCase();
      if (clean.length !== 2) return null;

      setLoading(true);
      try {
        for (const cfg of COLUMN_CONFIGS) {
          const select = `${cfg.zipCol}, ${cfg.cityCol}, ${cfg.stateCol}`;
          const { data, error } = await selectFromZipTable((tableName) =>
            (supabase as any)
              .from(tableName)
              .select(select)
              .eq(cfg.stateCol, clean)
              .order(cfg.cityCol, { ascending: true })
              .limit(1)
              .maybeSingle(),
          );

          if (error) continue;
          const normalized = normalizeRecord(data, cfg);
          if (normalized) return normalized;
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Debounced wrapper — waits `delay` ms after the last call before executing.
   * Returns a cleanup function that cancels a pending lookup.
   */
  const debounced = useCallback(
    (fn: () => void, delay = 400) => {
      clearDebounce();
      debounceRef.current = setTimeout(fn, delay);
    },
    []
  );

  return { lookupByZip, lookupByCity, lookupByCityState, lookupByState, debounced, loading };
}
