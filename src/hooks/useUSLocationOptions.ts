import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Postgres folds unquoted identifiers to lowercase. If the table was created
// without quotes in SQL, `all_US_zipcode` will actually be `all_us_zipcode`.
const TABLE_CANDIDATES = ["all_US_zipcode", "all_us_zipcode"] as const;

function uniqSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export type USStateOption = { label: string; value: string };

// All 50 US states — hardcoded so the dropdown is instant with no network request.
// value = 2-letter USPS abbreviation (matches usps_default_state in the DB table).
// label = full state name shown to the user.
export const US_STATES: USStateOption[] = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

// PostgREST caps responses at 1,000 rows per request.
// This helper paginates through a table and returns all matching rows.
// Cast to `any` because `all_US_zipcode` is not in the auto-generated types
// (it was created directly in Supabase, outside migrations).
const db = supabase as any;

async function paginateZipTable(
  buildQuery: (tableName: string, offset: number, pageSize: number) => any,
  maxRows = 20000,
) {
  const pageSize = 1000;

  for (const tableName of TABLE_CANDIDATES) {
    const out: any[] = [];
    let succeeded = true;

    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const { data, error } = await buildQuery(tableName, offset, pageSize);
      if (error) { succeeded = false; break; }
      out.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    if (succeeded) return out;
  }

  return [];
}

/** Distinct counties for a US state (ordered alphabetically). */
export function useUSCountiesByState(state: string | null | undefined) {
  const stateClean = (state ?? "").trim().toUpperCase();
  return useQuery({
    queryKey: ["us_location", "counties", stateClean] as const,
    queryFn: async (): Promise<string[]> => {
      const rows = await paginateZipTable((tableName, offset, pageSize) =>
        db
          .from(tableName)
          .select("county")
          .eq("usps_default_state", stateClean)
          .order("county", { ascending: true })
          .range(offset, offset + pageSize - 1),
      );
      const counties = rows.map((r: any) => String(r.county ?? "").trim());
      return uniqSorted(counties);
    },
    enabled: stateClean.length === 2,
    staleTime: 1000 * 60 * 60 * 24, // 24h
  });
}

/**
 * Distinct cities for a US state, optionally narrowed by county.
 * - If county is provided → returns cities for that state+county only.
 * - If county is omitted  → returns all cities for the state (so City can
 *   be used independently of County).
 */
export function useUSCitiesByStateCounty(
  state: string | null | undefined,
  county: string | null | undefined,
) {
  const stateClean = (state ?? "").trim().toUpperCase();
  const countyClean = (county ?? "").trim();
  return useQuery({
    queryKey: ["us_location", "cities", stateClean, countyClean] as const,
    queryFn: async (): Promise<string[]> => {
      const rows = await paginateZipTable((tableName, offset, pageSize) => {
        let q = db
          .from(tableName)
          .select("usps_default_city")
          .eq("usps_default_state", stateClean)
          .order("usps_default_city", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (countyClean) q = q.eq("county", countyClean);
        return q;
      });
      const cities = rows.map((r: any) => String(r.usps_default_city ?? "").trim());
      return uniqSorted(cities);
    },
    // Enabled as soon as state is selected; county is optional.
    enabled: stateClean.length === 2,
    staleTime: 1000 * 60 * 60 * 24, // 24h
  });
}

/**
 * Look up the county for a given city + state abbreviation.
 * Returns null if not found. Used to auto-select county when a city is chosen directly.
 */
export async function lookupCountyByCity(
  state: string,
  city: string,
): Promise<string | null> {
  const stateClean = state.trim().toUpperCase();
  const cityClean = city.trim();
  if (stateClean.length !== 2 || !cityClean) return null;

  for (const tableName of TABLE_CANDIDATES) {
    const { data, error } = await db
      .from(tableName)
      .select("county")
      .eq("usps_default_state", stateClean)
      .ilike("usps_default_city", cityClean)
      .order("county", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error && data?.county) return String(data.county).trim();
  }
  return null;
}
