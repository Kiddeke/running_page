import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Set them in a local .env file — see README "Setting up Supabase".'
  );
}

// Browser sessions persist via the client's default localStorage-based
// storage — no custom adapter needed here, unlike the RN app.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
