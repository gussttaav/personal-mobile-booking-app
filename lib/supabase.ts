import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/config';

// SCOPE FENCE: this Supabase client exists ONLY for in-session chat Realtime (S15).
// Payment confirmation is deliberately POLL-ONLY (see CLAUDE.md / lib/payment-confirmation.ts);
// do NOT wire this client into the payment flow or reintroduce a Realtime payment path.
//
// Chat does not use Supabase auth, so session persistence is disabled — this also avoids
// pulling in an AsyncStorage/native storage dependency.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
