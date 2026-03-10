import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { createSession, validateSession, deleteSession, cleanupExpiredSessions } from "./session-store.js";
import { createUser } from "./user-store.js";
import { getDb } from "./db/database.js";

const TEST_EMAIL = `session-test-${crypto.randomUUID()}@example.com`;
let testUserId: string;

beforeEach(async () => {
  // Clean up any existing test data
  getDb().query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)").run(TEST_EMAIL);
  getDb().query("DELETE FROM users WHERE email = ?").run(TEST_EMAIL);
  const user = await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "Session Test" });
  testUserId = user.id;
});

afterAll(() => {
  getDb().query("DELETE FROM sessions WHERE user_id = ?").run(testUserId);
  getDb().query("DELETE FROM users WHERE id = ?").run(testUserId);
});

describe("session-store", () => {
  test("createSession returns session with id and expiresAt", () => {
    const session = createSession(testUserId);
    expect(session.id).toBeTruthy();
    expect(session.expiresAt).toBeTruthy();
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test("validateSession returns user for valid session", () => {
    const session = createSession(testUserId);
    const user = validateSession(session.id);
    expect(user).not.toBeNull();
    expect(user!.id).toBe(testUserId);
  });

  test("validateSession returns null for invalid session", () => {
    const user = validateSession("nonexistent-session-id");
    expect(user).toBeNull();
  });

  test("deleteSession invalidates the session", () => {
    const session = createSession(testUserId);
    deleteSession(session.id);
    const user = validateSession(session.id);
    expect(user).toBeNull();
  });

  test("cleanupExpiredSessions removes old sessions", () => {
    // Insert an expired session directly
    const expiredId = crypto.randomUUID();
    getDb().query("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(expiredId, testUserId, new Date().toISOString(), "2020-01-01T00:00:00.000Z");

    const cleaned = cleanupExpiredSessions();
    expect(cleaned).toBeGreaterThanOrEqual(1);

    const user = validateSession(expiredId);
    expect(user).toBeNull();
  });
});
