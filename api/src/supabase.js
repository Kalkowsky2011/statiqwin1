import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://elywtkwjqzzplonehquf.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_q4joGSOsQEcfekUCGN4d0Q_omMFBKoE';

/**
 * Global Supabase client instance for STATIQWIN.
 * Configured with autoRefreshToken, persistSession, and local storage support.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
  },
});
