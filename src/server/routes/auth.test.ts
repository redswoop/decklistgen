import { describe, test, expect, afterAll } from "bun:test";
import { Hono } from "hono";
import { authRouter } from "./auth.js";
import { sessionMiddleware } from "../middleware/auth.js";
import { deleteUser, findUserByEmail } from "../services/user-store.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", sessionMiddleware);
app.route("/auth", authRouter);

const TEST_PREFIX = `auth-test-${Date.now()}`;
const createdEmails: string[] = [];

function req(path: string, opts?: RequestInit) {
  return app.request(path, opts);
}

function jsonPost(path: string, body: unknown) {
  return req(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterAll(() => {
  for (const email of createdEmails) {
    const user = findUserByEmail(email);
    if (user) deleteUser(user.id);
  }
});

describe("POST /auth/register", () => {
  const email = `${TEST_PREFIX}@test.local`;

  test("creates account and returns user", async () => {
    createdEmails.push(email);
    const res = await jsonPost("/auth/register", {
      email,
      password: "testpass123",
      displayName: "Test User",
    });
    expect(res.status).toBe(201);
    const user = await res.json();
    expect(user.email).toBe(email);
    expect(user.displayName).toBe("Test User");
    expect(user.isAdmin).toBe(false);
    expect(user.isAuthorized).toBe(false);
  });

  test("sets session cookie on registration", async () => {
    const regEmail = `${TEST_PREFIX}-session@test.local`;
    createdEmails.push(regEmail);
    const res = await jsonPost("/auth/register", {
      email: regEmail,
      password: "testpass123",
      displayName: "Session Test",
    });
    expect(res.status).toBe(201);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("session=");
  });

  test("rejects duplicate email", async () => {
    const res = await jsonPost("/auth/register", {
      email,
      password: "testpass123",
      displayName: "Duplicate",
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already exists");
  });

  test("rejects missing fields", async () => {
    const res = await jsonPost("/auth/register", {
      email: `${TEST_PREFIX}-missing@test.local`,
      password: "testpass123",
      displayName: "",
    });
    expect(res.status).toBe(400);
  });

  test("rejects short password", async () => {
    const res = await jsonPost("/auth/register", {
      email: `${TEST_PREFIX}-short@test.local`,
      password: "1234567",
      displayName: "Short PW",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("8 characters");
  });

  test("registered user can log in", async () => {
    const res = await jsonPost("/auth/login", {
      email,
      password: "testpass123",
    });
    expect(res.status).toBe(200);
    const user = await res.json();
    expect(user.email).toBe(email);
  });
});

describe("API tokens (/auth/tokens)", () => {
  async function registerAndCookie(): Promise<string> {
    const email = `${TEST_PREFIX}-tok-${Math.random().toString(36).slice(2)}@test.local`;
    createdEmails.push(email);
    const res = await jsonPost("/auth/register", { email, password: "testpassword1", displayName: "Tok" });
    expect(res.status).toBe(201);
    const cookie = res.headers.get("set-cookie") ?? "";
    return cookie.split(";")[0];
  }

  test("requires a session", async () => {
    expect((await req("/auth/tokens")).status).toBe(401);
    expect((await jsonPost("/auth/tokens", { label: "x" })).status).toBe(401);
  });

  test("mint → list → use as bearer → revoke", async () => {
    const cookie = await registerAndCookie();
    const mint = await req("/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ label: "remote claude" }),
    });
    expect(mint.status).toBe(201);
    const created = await mint.json();
    expect(created.token.startsWith("dg_")).toBe(true);
    expect(created.label).toBe("remote claude");

    const list = await req("/auth/tokens", { headers: { Cookie: cookie } });
    const { tokens } = await list.json();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(created.id);
    expect(JSON.stringify(tokens)).not.toContain(created.token);

    // The bearer token authenticates like a session.
    const me = await req("/auth/me", { headers: { Authorization: `Bearer ${created.token}` } });
    expect(me.status).toBe(200);
    expect((await me.json()).displayName).toBe("Tok");

    const del = await req(`/auth/tokens/${created.id}`, { method: "DELETE", headers: { Cookie: cookie } });
    expect(del.status).toBe(200);
    const meAfter = await req("/auth/me", { headers: { Authorization: `Bearer ${created.token}` } });
    expect(meAfter.status).toBe(401);
    expect((await req(`/auth/tokens/${created.id}`, { method: "DELETE", headers: { Cookie: cookie } })).status).toBe(404);
  });

  test("label is required and bounded", async () => {
    const cookie = await registerAndCookie();
    const h = { "Content-Type": "application/json", Cookie: cookie };
    expect((await req("/auth/tokens", { method: "POST", headers: h, body: "{}" })).status).toBe(400);
    expect((await req("/auth/tokens", { method: "POST", headers: h, body: JSON.stringify({ label: "x".repeat(81) }) })).status).toBe(400);
  });

  test("a garbage bearer header is just anonymous", async () => {
    const me = await req("/auth/me", { headers: { Authorization: "Bearer dg_garbage" } });
    expect(me.status).toBe(401);
  });
});
