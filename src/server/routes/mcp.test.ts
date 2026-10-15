import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import mcpRouter, { publicBaseUrl } from "./mcp.js";
import { sessionMiddleware } from "../middleware/auth.js";
import { createUser, deleteUser } from "../services/user-store.js";
import { createApiToken } from "../services/api-token-store.js";
import type { AppEnv } from "../types.js";

function makeApp() {
  const app = new Hono<AppEnv>();
  app.use("*", sessionMiddleware);
  app.route("/api/mcp", mcpRouter);
  return app;
}

const baseHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  "Mcp-Protocol-Version": "2024-11-05",
};

function rpc(method: string, params: unknown, id: number | string = 1) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

async function call(
  app: ReturnType<typeof makeApp>,
  body: string,
  opts: { path?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; json: unknown }> {
  const res = await app.request(opts.path ?? "/api/mcp", {
    method: "POST",
    headers: { ...baseHeaders, ...(opts.headers ?? {}) },
    body,
  });
  const text = await res.text();
  if (!text) return { status: res.status, json: null };
  // enableJsonResponse → single JSON object; SSE fallback would be `event: message\ndata: {...}`
  if (text.startsWith("event:") || text.startsWith("data:")) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    return { status: res.status, json: dataLine ? JSON.parse(dataLine.slice(6)) : null };
  }
  return { status: res.status, json: JSON.parse(text) };
}

describe("POST /api/mcp (Streamable HTTP transport)", () => {
  test("initialize returns serverInfo and capabilities", async () => {
    const app = makeApp();
    const res = await call(
      app,
      rpc("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
      }),
    );
    expect(res.status).toBe(200);
    const payload = res.json as { result?: { serverInfo?: { name?: string }; capabilities?: unknown } };
    expect(payload.result?.serverInfo?.name).toBe("decklistgen");
    expect(payload.result?.capabilities).toBeDefined();
  });

  test("tools/list over HTTP enumerates the registered tools", async () => {
    const app = makeApp();
    // Stateless mode: each request is independent; tools/list is accepted without prior initialize.
    const res = await call(app, rpc("tools/list", {}, 2));
    expect(res.status).toBe(200);
    const payload = res.json as { result?: { tools?: Array<{ name: string }> } };
    const names = (payload.result?.tools ?? []).map((t) => t.name);
    expect(names).toContain("list_sets");
    expect(names).toContain("search_cards");
    expect(names).toContain("get_card_image_url");
  });

  test("tools/call invokes list_sets", async () => {
    const app = makeApp();
    const res = await call(
      app,
      rpc("tools/call", { name: "list_sets", arguments: {} }, 3),
    );
    expect(res.status).toBe(200);
    const payload = res.json as {
      result?: { content?: Array<{ type: string; text?: string }> };
    };
    const text = payload.result?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    expect(Array.isArray(parsed.sets)).toBe(true);
    expect(parsed.total).toBeGreaterThan(0);
  });
});

describe("MCP auth plumbing", () => {
  const PREFIX = `mcp-route-${Date.now()}`;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    const u = await createUser({ email: `${PREFIX}@test.local`, password: "testpassword1", displayName: "Mcp Route", isAuthorized: true });
    userId = u.id;
    token = createApiToken(userId, "route test").token;
  });
  afterAll(() => deleteUser(userId));

  function whoami(res: { json: unknown }) {
    const payload = res.json as { result?: { isError?: boolean; content?: Array<{ text?: string }> } };
    return { isError: !!payload.result?.isError, data: JSON.parse(payload.result?.content?.[0]?.text ?? "null") };
  }

  test("anonymous POST is served but deck tools refuse", async () => {
    const res = await call(makeApp(), rpc("tools/call", { name: "whoami", arguments: {} }, 4));
    expect(res.status).toBe(200);
    expect(whoami(res).isError).toBe(true);
  });

  test("Authorization: Bearer identifies the caller", async () => {
    const res = await call(makeApp(), rpc("tools/call", { name: "whoami", arguments: {} }, 5), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(whoami(res)).toMatchObject({ isError: false, data: { id: userId, displayName: "Mcp Route" } });
  });

  test("/api/mcp/t/<token> identifies the caller for URL-only clients", async () => {
    const res = await call(makeApp(), rpc("tools/call", { name: "whoami", arguments: {} }, 6), {
      path: `/api/mcp/t/${token}`,
    });
    expect(res.status).toBe(200);
    expect(whoami(res).data.id).toBe(userId);
  });

  test("/api/mcp/t/<bad token> is a 401, not an anonymous session", async () => {
    const res = await call(makeApp(), rpc("tools/call", { name: "whoami", arguments: {} }, 7), {
      path: "/api/mcp/t/dg_bogus",
    });
    expect(res.status).toBe(401);
  });
});

describe("publicBaseUrl", () => {
  test("uses the request origin by default", () => {
    expect(publicBaseUrl(new Request("http://localhost:3001/api/mcp"))).toBe("http://localhost:3001");
  });

  test("trusts the reverse proxy's X-Forwarded-* headers", () => {
    const req = new Request("http://10.0.0.5:1996/api/mcp/t/dg_x", {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "decks.example.test" },
    });
    expect(publicBaseUrl(req)).toBe("https://decks.example.test");
  });

  test("PUBLIC_URL overrides everything", () => {
    const prev = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = "https://override.example.test/";
    try {
      const req = new Request("http://localhost:3001/api/mcp", { headers: { "x-forwarded-host": "nope" } });
      expect(publicBaseUrl(req)).toBe("https://override.example.test");
    } finally {
      if (prev === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = prev;
    }
  });
});
