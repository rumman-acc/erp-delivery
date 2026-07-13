"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMcpTokens } from "@/lib/data/mcpTokens";
import { generateMcpToken, hashMcpToken } from "@/lib/mcp/token";

export async function loadMcpTokensData() {
  return getMcpTokens();
}

// Returns the raw token exactly once — only its hash is ever stored
// (supabase/migrations/20260712000001_mcp_tokens.sql), so this is the only
// chance the caller gets to see/copy it.
export async function createMcpToken(label: string) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { error: "Not signed in" };

  const token = generateMcpToken();
  const { error } = await supabase.from("mcp_tokens").insert({
    user_id: userId,
    label: label.trim() || "Untitled token",
    token_hash: hashMcpToken(token),
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { token };
}

export async function revokeMcpToken(id: string) {
  const supabase = await createClient();
  // RLS (mcp_tokens_update_own) already confines this to the caller's own
  // tokens; no extra .eq("user_id", ...) needed.
  const { error } = await supabase.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
}
