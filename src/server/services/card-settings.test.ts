import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import {
  getCardSettings,
  updateCardSettings,
  deleteCardSettings,
  getAllCardSettings,
  hasCardSettings,
} from "./card-settings.js";
import { getDb } from "./db/database.js";

const TEST_USER_ID = "test-user-settings-" + crypto.randomUUID();

beforeEach(() => {
  // Clean up test card settings
  getDb().query("DELETE FROM card_settings WHERE user_id = ?").run(TEST_USER_ID);
  // Ensure test user exists
  getDb().query("INSERT OR IGNORE INTO users (id, email, password_hash, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)").run(TEST_USER_ID, `${TEST_USER_ID}@test.com`, "hash", "Test User", new Date().toISOString(), new Date().toISOString());
});

afterAll(() => {
  getDb().query("DELETE FROM card_settings WHERE user_id = ?").run(TEST_USER_ID);
  getDb().query("DELETE FROM users WHERE id = ?").run(TEST_USER_ID);
});

describe("card-settings", () => {
  test("getCardSettings returns empty object for unknown card", () => {
    const settings = getCardSettings(TEST_USER_ID, "nonexistent-card");
    expect(settings).toEqual({});
  });

  test("updateCardSettings stores and retrieves settings", () => {
    const result = updateCardSettings(TEST_USER_ID, "sv06.5-036", { fontSize: 32 });
    expect(result.fontSize).toBe(32);

    const retrieved = getCardSettings(TEST_USER_ID, "sv06.5-036");
    expect(retrieved.fontSize).toBe(32);
  });

  test("updateCardSettings merges with existing", () => {
    updateCardSettings(TEST_USER_ID, "sv06.5-036", { fontSize: 32 });
    updateCardSettings(TEST_USER_ID, "sv06.5-036", { maxCover: 0.4 });

    const settings = getCardSettings(TEST_USER_ID, "sv06.5-036");
    expect(settings.fontSize).toBe(32);
    expect(settings.maxCover).toBe(0.4);
  });

  test("hasCardSettings returns correct boolean", () => {
    updateCardSettings(TEST_USER_ID, "sv01-001", { fontSize: 36 });
    expect(hasCardSettings(TEST_USER_ID, "sv01-001")).toBe(true);
    expect(hasCardSettings(TEST_USER_ID, "nonexistent")).toBe(false);
  });

  test("deleteCardSettings removes settings", () => {
    updateCardSettings(TEST_USER_ID, "to-delete", { fontSize: 28 });
    expect(hasCardSettings(TEST_USER_ID, "to-delete")).toBe(true);

    const result = deleteCardSettings(TEST_USER_ID, "to-delete");
    expect(result).toBe(true);
    expect(hasCardSettings(TEST_USER_ID, "to-delete")).toBe(false);
    expect(getCardSettings(TEST_USER_ID, "to-delete")).toEqual({});
  });

  test("deleteCardSettings returns false for nonexistent card", () => {
    expect(deleteCardSettings(TEST_USER_ID, "never-existed")).toBe(false);
  });

  test("getAllCardSettings returns all entries for user", () => {
    updateCardSettings(TEST_USER_ID, "card-a", { fontSize: 30 });
    updateCardSettings(TEST_USER_ID, "card-b", { maxCover: 0.6 });

    const all = getAllCardSettings(TEST_USER_ID);
    expect(all["card-a"]?.fontSize).toBe(30);
    expect(all["card-b"]?.maxCover).toBe(0.6);
  });
});
