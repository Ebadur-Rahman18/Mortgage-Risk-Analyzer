/**
 * URL + anon/publishable key for browser calls (Edge Functions, etc.).
 * Uses Vite env when set; otherwise dev fallback so /portal works when the app
 * runs via client-override without a populated .env.
 */
const DEV_FALLBACK_URL = "https://spppmtgzugvknfqeyjqq.supabase.co";
const DEV_FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcHBtdGd6dWd2a25mcWV5anFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDM3NTMsImV4cCI6MjA4NTc3OTc1M30.71_tp6DUka0REiaaAZ25Fnc4tVUaEuOM6Hyuhajs1o4";

export function getSupabasePublicConfig(): { url: string; key: string } {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (url && key) return { url, key };
  // Same fallback as legacy client-override when .env is empty (local or misconfigured deploy).
  if (DEV_FALLBACK_URL && DEV_FALLBACK_KEY) {
    return { url: DEV_FALLBACK_URL, key: DEV_FALLBACK_KEY };
  }
  throw new Error(
    "Missing VITE_SUPABASE_URL and a publishable/anon key (VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY).",
  );
}

/** Subdomain from `https://<ref>.supabase.co` — matches the ref in the Supabase dashboard URL. */
export function getSupabaseProjectRef(supabaseUrl: string): string | null {
  try {
    const { hostname } = new URL(supabaseUrl);
    const m = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export type SupabaseDashboardLinks = {
  ref: string | null;
  projectUrl: string;
  apiSettingsUrl: string;
  databaseTablesUrl: string;
  logsExplorerUrl: string;
};

/** Deep links into the Supabase Dashboard for the project backing this app. */
export function getSupabaseDashboardLinks(): SupabaseDashboardLinks {
  const { url } = getSupabasePublicConfig();
  const ref = getSupabaseProjectRef(url);

  if (!ref) {
    const fallback = "https://supabase.com/dashboard/projects";
    return {
      ref: null,
      projectUrl: fallback,
      apiSettingsUrl: fallback,
      databaseTablesUrl: fallback,
      logsExplorerUrl: fallback,
    };
  }

  const base = `https://supabase.com/dashboard/project/${ref}`;
  return {
    ref,
    projectUrl: base,
    apiSettingsUrl: `${base}/settings/api`,
    databaseTablesUrl: `${base}/database/tables`,
    logsExplorerUrl: `${base}/logs/explorer`,
  };
}
