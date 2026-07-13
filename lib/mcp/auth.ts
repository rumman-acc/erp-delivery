import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createServiceClient } from "@/lib/supabase/service";
import { hashMcpToken } from "@/lib/mcp/token";

// verifyToken callback for mcp-handler's withMcpAuth (app/api/[transport]/route.ts).
// Looks up the bearer token against mcp_tokens using the service-role client —
// there is no logged-in session yet at this point, so this is one of the rare
// legitimate uses of that client (see lib/supabase/service.ts).
export async function verifyMcpToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const service = createServiceClient();
  const { data: row } = await service
    .from("mcp_tokens")
    .select("id, user_id")
    .eq("token_hash", hashMcpToken(bearerToken))
    .is("revoked_at", null)
    .maybeSingle();

  if (!row) return undefined;

  await service.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);

  return {
    token: bearerToken,
    clientId: row.id,
    scopes: [],
    extra: { userId: row.user_id, mcpTokenId: row.id },
  };
}

type CachedSession = { accessToken: string; refreshToken: string; expiresAt: number };

// Per-process cache so we don't mint a fresh Supabase session on every single
// tool call — cold on each new server instance, which is fine for a POC.
const sessionCache = new Map<string, CachedSession>();

// Impersonates a real user so every existing RLS policy / can_edit_module
// check (lib/permissions.ts, supabase/migrations/20260705000003_rls_policies.sql)
// applies exactly as it would for that user signed in through the browser —
// an MCP token grants no privilege beyond what its owner already has.
export async function getUserScopedClient(userId: string) {
  const cached = sessionCache.get(userId);
  const now = Math.floor(Date.now() / 1000);

  if (cached && cached.expiresAt - 30 > now) {
    return buildClient(cached.accessToken);
  }

  const session = await mintSessionForUser(userId);
  sessionCache.set(userId, session);
  return buildClient(session.accessToken);
}

async function mintSessionForUser(userId: string): Promise<CachedSession> {
  const service = createServiceClient();

  const { data: profile, error: profileError } = await service.from("profiles").select("email").eq("id", userId).single();
  if (profileError || !profile?.email) {
    throw new Error(`MCP: no profile/email found for user ${userId}`);
  }

  // generateLink + verifyOtp is the supported way to mint a real session for
  // a user from a trusted backend without ever handling their password —
  // there's no shared JWT secret to sign against on this Supabase project.
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
  });
  if (linkError || !link) {
    throw new Error(`MCP: failed to generate session for user ${userId}: ${linkError?.message}`);
  }

  const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified.session) {
    throw new Error(`MCP: failed to verify session for user ${userId}: ${verifyError?.message}`);
  }

  return {
    accessToken: verified.session.access_token,
    refreshToken: verified.session.refresh_token,
    expiresAt: verified.session.expires_at ?? nowPlusSeconds(3600),
  };
}

function nowPlusSeconds(seconds: number) {
  return Math.floor(Date.now() / 1000) + seconds;
}

function buildClient(accessToken: string) {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
