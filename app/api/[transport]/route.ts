import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";

// Dynamic [transport] segment is mcp-handler's routing convention: with
// basePath "/api" this resolves to /api/mcp (Streamable HTTP) and /api/sse.
// Point an agent-builder platform's "remote MCP server" URL at /api/mcp.
const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  }
);

// Every call authenticates as the mcp_tokens row's owning user (lib/mcp/auth.ts)
// — RLS stays the enforcement boundary, this just identifies who's asking.
const authedHandler = withMcpAuth(handler, verifyMcpToken, { required: true });

export { authedHandler as GET, authedHandler as POST };
