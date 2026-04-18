import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import mcpRouter from "./mcp.js";

function makeApp() {
  const app = new Hono();
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

async function call(app: ReturnType<typeof makeApp>, body: string): Promise<{ status: number; json: unknown }> {
  const res = await app.request("/api/mcp", {
    method: "POST",
    headers: baseHeaders,
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
    expect(names).toContain("render_proxy_svg");
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
