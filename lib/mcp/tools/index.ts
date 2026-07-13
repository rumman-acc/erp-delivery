import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUserScopedClient } from "@/lib/mcp/auth";

function currentUserId(extra: { authInfo?: { extra?: Record<string, unknown> } }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("Not authenticated");
  return userId;
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

// Phase 1 (foundation): one read-only tool to prove the auth path works end
// to end — bearer token -> mcp_tokens lookup -> impersonated user session ->
// RLS-scoped query. Domain tools (kanban, risks, resources, dashboard, scope)
// land in later phases as their own files here, each registered from this hub.
export function registerTools(server: McpServer) {
  server.registerTool(
    "whoami",
    {
      title: "Whoami",
      description: "Returns the profile and project memberships of the user this MCP token belongs to.",
      inputSchema: {},
    },
    async (_args, extra) => {
      try {
        const userId = currentUserId(extra);
        const supabase = await getUserScopedClient(userId);

        const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, email, is_super_admin").eq("id", userId).single(),
          supabase.from("project_members").select("project_id, projects(name), roles(name)").eq("user_id", userId),
        ]);

        if (profileError) return errorResult(profileError.message);
        if (membershipError) return errorResult(membershipError.message);

        return textResult({ profile, projects: memberships });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : "Unknown error");
      }
    }
  );
}
