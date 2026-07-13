import { createHash, randomBytes } from "node:crypto";

// Only the SHA-256 hash is ever persisted (supabase/migrations/20260712000001_mcp_tokens.sql)
// — the raw value below is shown to the user exactly once, at creation time.
export function generateMcpToken(): string {
  return `mcp_${randomBytes(24).toString("hex")}`;
}

export function hashMcpToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
