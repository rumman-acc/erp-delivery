import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/microsoft/graph";

export type ValidConnection = {
  connectionId: string;
  accessToken: string;
};

type ConnectionRow = { id: string; encrypted_refresh_token: string; status: string };

// Shared by both call paths below — refreshes one connection's access token
// and persists the (possibly rotated) refresh token. Works with either the
// user-session client (RLS-scoped to that user's own row) or the
// service-role client (cron, no user session to scope to).
async function refreshConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  connection: ConnectionRow
): Promise<ValidConnection | null> {
  if (connection.status !== "active") return null;

  try {
    const refreshToken = decryptToken(connection.encrypted_refresh_token);
    const tokens = await refreshAccessToken(refreshToken);

    await supabase
      .from("agent_connections")
      .update({
        encrypted_refresh_token: encryptToken(tokens.refresh_token),
        last_refreshed_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return { connectionId: connection.id, accessToken: tokens.access_token };
  } catch (err) {
    console.error("Microsoft token refresh failed:", err);
    // The refresh token itself is invalid/revoked (e.g. the admin removed
    // access from Microsoft's side) — mark it so callers can prompt a
    // reconnect instead of silently failing every time.
    await supabase.from("agent_connections").update({ status: "expired" }).eq("id", connection.id);
    return null;
  }
}

// Refreshes the *current signed-in user's* Microsoft access token — used by
// user-facing Server Components/Actions (e.g. the "Your Meetings" list).
export async function getValidAccessToken(): Promise<ValidConnection | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: connection } = await supabase
    .from("agent_connections")
    .select("id,encrypted_refresh_token,status")
    .eq("connected_by", userId)
    .maybeSingle();

  if (!connection) return null;
  return refreshConnection(supabase, connection);
}

// Refreshes a *specific* connection by ID, regardless of who's signed in —
// there is no signed-in user in a cron request. Caller must pass a
// service-role client (lib/supabase/service.ts), since RLS has no session
// to scope to here.
export async function getValidAccessTokenForConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  connectionId: string
): Promise<ValidConnection | null> {
  const { data: connection } = await supabase
    .from("agent_connections")
    .select("id,encrypted_refresh_token,status")
    .eq("id", connectionId)
    .maybeSingle();

  if (!connection) return null;
  return refreshConnection(supabase, connection);
}
