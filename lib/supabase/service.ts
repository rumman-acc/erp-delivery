import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Trusted backend-only client — bypasses RLS entirely using the service
// role key. Never expose this key to the browser (no NEXT_PUBLIC_ prefix)
// and only reach for this client where there is genuinely no logged-in user
// driving the request (cron jobs, webhooks). Everywhere else, use
// lib/supabase/server.ts so RLS stays the real enforcement boundary.
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
