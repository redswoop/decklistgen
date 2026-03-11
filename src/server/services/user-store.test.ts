import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { createUser, createUserWithoutPassword, findUserByEmail, findUserById, verifyPassword, getUserCount, listAllUsers, setUserAuthorized, setUserAdmin, deleteUser } from "./user-store.js";
import { getDb } from "./db/database.js";

const TEST_EMAIL = `test-${crypto.randomUUID()}@example.com`;

beforeEach(() => {
  getDb().query("DELETE FROM users WHERE email = ?").run(TEST_EMAIL.toLowerCase());
});

afterAll(() => {
  getDb().query("DELETE FROM users WHERE email = ?").run(TEST_EMAIL.toLowerCase());
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
    expect(user.isAuthorized).toBe(false);
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

  test("createUser with isAuthorized creates authorized user", async () => {
    const user = await createUser({
      email: TEST_EMAIL,
      password: "testpassword123",
      displayName: "Auth User",
      isAuthorized: true,
    });
    expect(user.isAuthorized).toBe(true);
  });

  test("createUserWithoutPassword creates user with empty hash", () => {
    const user = createUserWithoutPassword({
      email: TEST_EMAIL,
      displayName: "No Pass",
    });
    expect(user.id).toBeTruthy();
    expect(user.isAuthorized).toBe(false);
    const found = findUserByEmail(TEST_EMAIL);
    expect(found!.passwordHash).toBe("");
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

  test("verifyPassword returns false for empty hash", async () => {
    expect(await verifyPassword("anything", "")).toBe(false);
  });

  test("getUserCount returns correct count", async () => {
    const before = getUserCount();
    await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "Count" });
    expect(getUserCount()).toBe(before + 1);
  });

  test("listAllUsers returns all users with hasPassword", async () => {
    await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "Listed" });
    const users = listAllUsers();
    const found = users.find((u) => u.email === TEST_EMAIL.toLowerCase());
    expect(found).toBeTruthy();
    expect(found!.hasPassword).toBe(true);
  });

  test("setUserAuthorized toggles authorization", async () => {
    const user = await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "Toggle" });
    expect(user.isAuthorized).toBe(false);

    const updated = setUserAuthorized(user.id, true);
    expect(updated!.isAuthorized).toBe(true);

    const reverted = setUserAuthorized(user.id, false);
    expect(reverted!.isAuthorized).toBe(false);
  });

  test("setUserAdmin toggles admin", async () => {
    const user = await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "Admin Toggle" });
    expect(user.isAdmin).toBe(false);

    const updated = setUserAdmin(user.id, true);
    expect(updated!.isAdmin).toBe(true);
  });

  test("deleteUser removes user", async () => {
    const user = await createUser({ email: TEST_EMAIL, password: "pass12345678", displayName: "Delete Me" });
    expect(deleteUser(user.id)).toBe(true);
    expect(findUserById(user.id)).toBeNull();
  });

  test("deleteUser returns false for nonexistent", () => {
    expect(deleteUser("nonexistent-id")).toBe(false);
  });
});
