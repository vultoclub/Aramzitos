import { createClient } from "@supabase/supabase-js";

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Backwards-compat alias usado em interactions.js
export const supabase = new Proxy({}, {
  get(_, prop) { return getSupabase()[prop]; },
});
