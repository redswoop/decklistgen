import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../mcp/server.js";

const app = new Hono();

/**
 * MCP Streamable-HTTP endpoint.
 *
 * Stateless: a fresh McpServer + transport is built per request, so any Hono
 * worker can serve any request without shared session state. Good enough for
 * the read-only tools we expose today. When we add mutation tools that need
 * auth + long-lived streams, revisit with a session store.
 */
app.all("/", async (c) => {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  c.req.raw.signal?.addEventListener("abort", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

export default app;
