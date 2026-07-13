import { createClient } from "@/lib/supabase/server";

export type McpTokenRow = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

// RLS (mcp_tokens_select_own) already restricts this to the caller's own
// tokens — no explicit .eq("user_id", ...) needed here.
export async function getMcpTokens(): Promise<McpTokenRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mcp_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    createdAt: t.created_at,
    lastUsedAt: t.last_used_at,
    revokedAt: t.revoked_at,
  }));
}
