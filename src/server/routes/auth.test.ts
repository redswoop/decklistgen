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
