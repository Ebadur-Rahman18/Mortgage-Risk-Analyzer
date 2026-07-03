import { supabase } from "@/lib/supabase";

/**
 * Lightweight client-side probes for admin dashboards (no fake uptime).
 * Uses the same Supabase session as the logged-in admin.
 */
export interface ClientHealthChecks {
  checkedAt: string;
  database: { ok: boolean; detail: string };
  auth: { ok: boolean; detail: string };
  storage: { ok: boolean; detail: string };
  edgeFunctions: { ok: boolean; activeCount: number; detail: string };
}

export async function runClientHealthChecks(): Promise<ClientHealthChecks> {
  const checkedAt = new Date().toISOString();

  const { error: dbError } = await supabase.from("profiles").select("id", { head: true });
  const database = {
    ok: !dbError,
    detail: dbError?.message ?? "PostgREST reachable",
  };

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  const auth = {
    ok: !sessionError && !!session,
    detail: sessionError?.message ?? (session ? "Session active" : "No active session"),
  };

  const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
  const storage = {
    ok: !storageError,
    detail: storageError?.message ?? `${buckets?.length ?? 0} bucket(s) visible`,
  };

  const { count, error: efError } = await supabase
    .from("edge_functions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const edgeFunctions = {
    ok: !efError,
    activeCount: count ?? 0,
    detail: efError?.message ?? `${count ?? 0} active in registry`,
  };

  return { checkedAt, database, auth, storage, edgeFunctions };
}
