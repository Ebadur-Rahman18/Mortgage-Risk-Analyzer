/**
 * TEMPORARY OVERRIDE FOR DEBUGGING
 * Uses the same public config as Edge Function calls (public-config.ts).
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getSupabasePublicConfig } from './public-config';

const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = getSupabasePublicConfig();

console.log('🔧 Using Supabase config (override path)');
console.log('URL:', SUPABASE_URL);
console.log('Key preview:', SUPABASE_PUBLISHABLE_KEY.substring(0, 30) + '...');

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
