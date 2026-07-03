/**
 * Verify the caller's Bearer JWT is an authenticated admin (user_roles.role = 'admin').
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function requireAdmin(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; message: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing or invalid Authorization header' };
  }
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  const admin: SupabaseClient = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (roleRow?.role !== 'admin') {
    return { ok: false, status: 403, message: 'Forbidden: admin role required' };
  }
  return { ok: true, userId: user.id };
}
