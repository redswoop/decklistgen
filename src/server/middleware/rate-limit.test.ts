import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { rateLimit } from "./rate-limit.js";

function createApp(max: number, windowMs: number) {
  const app = new Hono();
  app.use("*", rateLimit(max, windowMs));
  app.get("/", (c) => c.text("ok"));
  return app;
}

describe("rateLimit", () => {
  test("allows requests within limit", async () => {
    const app = createApp(3, 60_000);
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/");
      expect(res.status).toBe(200);
    }
  });

  test("blocks requests over limit with 429", async () => {
    const app = createApp(2, 60_000);
    await app.request("/");
    await app.request("/");
    const res = await app.request("/");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
  });

  test("sets rate limit headers", async () => {
    const app = createApp(5, 60_000);
    const res = await app.request("/");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  test("remaining decreases with each request", async () => {
    const app = createApp(3, 60_000);
    const r1 = await app.request("/");
    expect(r1.headers.get("X-RateLimit-Remaining")).toBe("2");
    const r2 = await app.request("/");
    expect(r2.headers.get("X-RateLimit-Remaining")).toBe("1");
    const r3 = await app.request("/");
    expect(r3.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  test("skipIf bypasses the limit entirely when it returns true", async () => {
    const app = new Hono();
    // Simulate session middleware setting a user on every request.
    app.use("*", async (c, next) => {
      c.set("user", { id: "u1" });
      await next();
    });
    app.use(
      "*",
      rateLimit(2, 60_000, { skipIf: (c) => !!c.get("user") }),
    );
    app.get("/", (c) => c.text("ok"));

    // Far above the cap of 2 — all should pass.
    for (let i = 0; i < 10; i++) {
      const res = await app.request("/");
      expect(res.status).toBe(200);
    }
  });

  test("skipIf still enforces the limit when it returns false", async () => {
    const app = new Hono();
    app.use(
      "*",
      rateLimit(2, 60_000, { skipIf: () => false }),
    );
    app.get("/", (c) => c.text("ok"));

    await app.request("/");
    await app.request("/");
    const res = await app.request("/");
    expect(res.status).toBe(429);
  });
});
