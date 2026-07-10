import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed middleware.ts -> proxy.ts (same request-interception role).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getClaims() verifies the JWT locally (this project uses asymmetric
  // signing keys) instead of round-tripping to the Auth server like
  // getUser() always does — cuts real, measured latency on every request.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Machine-to-machine endpoints authenticate via their own bearer secret
  // (checked inside the route handler itself), not a browser session — a
  // cron scheduler has no cookies to present here at all.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    return response;
  }

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  // The Microsoft SSO redirect lands here with a code to exchange for a
  // session — there's no session yet when this route first runs, so it must
  // be reachable before `user` can possibly be set.
  const isAuthCallbackRoute = request.nextUrl.pathname.startsWith("/auth/callback");

  if (!user && !isLoginRoute && !isAuthCallbackRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
