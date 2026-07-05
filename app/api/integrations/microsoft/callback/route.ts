import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getMe } from "@/lib/microsoft/graph";
import { encryptToken } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";

// Microsoft redirects here after the admin accepts (or denies) consent
// (plan-agentic.md §5 step 1). Exchanges the code for tokens, resolves the
// admin's Microsoft profile, and upserts agent_connections keyed by their
// profile — reconnecting replaces the stored token rather than duplicating
// the row.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const msError = request.nextUrl.searchParams.get("error");

  const redirectTo = new URL("/agent", request.url);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("ms_oauth_state")?.value;
  cookieStore.delete("ms_oauth_state");

  if (msError) {
    redirectTo.searchParams.set("agent_error", "microsoft_denied");
    return NextResponse.redirect(redirectTo);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    redirectTo.searchParams.set("agent_error", "invalid_state");
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getMe(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    const { error: dbError } = await supabase.from("agent_connections").upsert(
      {
        connected_by: userId,
        microsoft_user_id: profile.id,
        microsoft_email: profile.mail ?? profile.userPrincipalName,
        encrypted_refresh_token: encryptedRefreshToken,
        scopes: tokens.scope.split(" "),
        status: "active",
        last_refreshed_at: new Date().toISOString(),
      },
      { onConflict: "connected_by" }
    );
    if (dbError) throw new Error(dbError.message);

    await supabase.from("agent_audit_log").insert({
      actor_type: "human",
      actor_id: userId,
      action: "connection.created",
      entity_type: "agent_connections",
      details: { microsoft_email: profile.mail ?? profile.userPrincipalName },
    });

    redirectTo.searchParams.set("connected", "1");
  } catch (err) {
    console.error("Microsoft OAuth callback failed:", err);
    redirectTo.searchParams.set("agent_error", "connection_failed");
  }

  return NextResponse.redirect(redirectTo);
}
