import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Create a fresh client per request — never share/cache across requests
// (see @supabase/ssr's createServerClient docs bundled in node_modules/next).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component that can't set cookies — fine as
            // long as proxy.ts refreshes the session (see proxy.ts).
          }
        },
      },
    }
  );
}
