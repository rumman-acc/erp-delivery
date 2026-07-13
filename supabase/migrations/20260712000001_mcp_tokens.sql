-- MCP (Model Context Protocol) personal access tokens — lets an external
-- agent-builder platform call app/api/mcp/route.ts as a specific user.
-- RLS stays the real enforcement boundary (plan.md §6): a token only ever
-- impersonates the user it belongs to (see lib/mcp/auth.ts), so every
-- existing can_view_module/can_edit_module policy keeps applying unchanged.
--
-- Only a SHA-256 hash of the token is stored (never the raw value) — same
-- pattern as GitHub/Linear personal access tokens. The raw token is shown to
-- the user once, at creation time, and cannot be recovered afterward.

create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index mcp_tokens_user_id_idx on public.mcp_tokens (user_id);

alter table public.mcp_tokens enable row level security;

-- Users manage only their own tokens through the app UI. Token
-- *verification* (looking up a hash with no session yet) happens via
-- lib/supabase/service.ts's service-role client, which bypasses RLS by
-- design — the same pattern as CRON_SECRET-protected routes.
create policy mcp_tokens_select_own on public.mcp_tokens
  for select using (auth.uid() = user_id);

create policy mcp_tokens_insert_own on public.mcp_tokens
  for insert with check (auth.uid() = user_id);

-- "Delete" a token by revoking it (soft delete) so audit history survives;
-- exposed as an update of revoked_at rather than a hard delete.
create policy mcp_tokens_update_own on public.mcp_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
