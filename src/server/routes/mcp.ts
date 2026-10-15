import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../mcp/server.js";
import { validateApiToken } from "../services/api-token-store.js";
import type { AppEnv } from "../types.js";
import type { User } from "../../shared/types/user.js";

const app = new Hono<AppEnv>();

/**
 * MCP Streamable-HTTP endpoint.
 *
 * Stateless: a fresh McpServer + transport is built per request, so any Hono
 * worker can serve any request without shared session state. The caller's
 * identity (if any) is threaded into the server as its context, so the
 * read-only browse tools work anonymously while the deck / generate / sim
 * tools require a user.
 *
 * Two ways to authenticate:
 *   - `Authorization: Bearer dg_…` (resolved by sessionMiddleware; also works
 *     for an ordinary session cookie)
 *   - `/api/mcp/t/<token>` for clients that can only be given a URL, such as
 *     claude.ai custom connectors. The token segment is redacted from the
 *     access log in index.ts.
 */
/**
 * The origin remote clients should use for links we hand back (card images).
 * `PUBLIC_URL` wins; otherwise trust the reverse proxy's X-Forwarded-* headers,
 * else the request URL itself.
 */
export function publicBaseUrl(req: Request): string {
  const env = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  if (env) return env;
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(/:$/, "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || url.host;
  return `${proto}://${host}`;
}

async function serve(req: Request, user: User | null): Promise<Response> {
  const server = createMcpServer({ user, baseUrl: publicBaseUrl(req) });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  req.signal?.addEventListener("abort", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

app.all("/t/:token", async (c) => {
  const user = validateApiToken(c.req.param("token"));
  if (!user) return c.json({ error: "Invalid API token" }, 401);
  return serve(c.req.raw, user);
});

app.all("/", (c) => serve(c.req.raw, c.get("user") ?? null));

export default app;
