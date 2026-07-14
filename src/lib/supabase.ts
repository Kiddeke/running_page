import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

// Missing config must not throw at module scope: this module is pulled in by
// the lazy-loaded Faith tab, and a load-time throw would crash that whole tab
// on any deploy where the env vars aren't set yet. FaithAuthGate checks this
// flag and renders a setup notice instead, so the proxy below is unreachable
// in practice — it exists only to keep the exported type a plain
// SupabaseClient and fail loudly if some future code path skips the gate.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Browser sessions persist via the client's default localStorage-based
// storage — no custom adapter needed here, unlike the RN app.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
              'Set them in a local .env file — see README "Setting up Supabase".'
          );
        },
      }
    ) as SupabaseClient);
