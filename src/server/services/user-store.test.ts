import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { createUser, findUserByEmail, findUserById, verifyPassword, getUserCount } from "./user-store.js";
import { getDb } from "./db/database.js";

const TEST_EMAIL = `test-${crypto.randomUUID()}@example.com`;

beforeEach(() => {
  getDb().query("DELETE FROM users WHERE email = ?").run(TEST_EMAIL);
});

afterAll(() => {
  getDb().query("DELETE FROM users WHERE email = ?").run(TEST_EMAIL);
});

describe("user-store", () => {
  test("createUser creates a user and returns it", async () => {
    const user = await createUser({
      email: TEST_EMAIL,
      password: "testpassword123",
      displayName: "Test User",
    });
    expect(user.email).toBe(TEST_EMAIL.toLowerCase());
    expect(user.displayName).toBe("Test User");
    expect(user.isAdmin).toBe(false);
    expect(user.id).toBeTruthy();
  });

  test("createUser with isAdmin creates admin", async () => {
    const user = await createUser({
      email: TEST_EMAIL,
      password: "testpassword123",
      displayName: "Admin User",
      isAdmin: true,
    });
    expect(user.isAdmin).toBe(true);
  });

  test("findUserByEmail returns user with password hash", async () => {
    await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "Find Me" });
    const found = findUserByEmail(TEST_EMAIL);
    expect(found).not.toBeNull();
    expect(found!.email).toBe(TEST_EMAIL.toLowerCase());
    expect(found!.passwordHash).toBeTruthy();
  });

  test("findUserByEmail returns null for nonexistent", () => {
    const found = findUserByEmail("nonexistent@example.com");
    expect(found).toBeNull();
  });

  test("findUserById works after creation", async () => {
    const user = await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "By ID" });
    const found = findUserById(user.id);
    expect(found).not.toBeNull();
    expect(found!.displayName).toBe("By ID");
  });

  test("verifyPassword works correctly", async () => {
    await createUser({ email: TEST_EMAIL, password: "correctpass1", displayName: "Verify" });
    const user = findUserByEmail(TEST_EMAIL)!;
    expect(await verifyPassword("correctpass1", user.passwordHash)).toBe(true);
    expect(await verifyPassword("wrongpassword", user.passwordHash)).toBe(false);
  });

  test("getUserCount returns correct count", async () => {
    const before = getUserCount();
    await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "Count" });
    expect(getUserCount()).toBe(before + 1);
  });
});
