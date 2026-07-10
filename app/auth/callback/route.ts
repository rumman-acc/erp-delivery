import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Reached after Microsoft SSO redirects back through Supabase's own hosted
// callback (https://<project>.supabase.co/auth/v1/callback) — Supabase
// exchanges the Azure code for its own session token internally, then sends
// the browser here with a `code` query param for us to exchange for a
// Supabase session. proxy.ts exempts this path from the login-required
// redirect, since there's no session yet when this route first runs.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("error", "sso_failed");
      return NextResponse.redirect(url);
    }
  }

  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";
  return NextResponse.redirect(url);
}
