import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, copyFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const SETTINGS_PATH = join(import.meta.dir, "../../../data/card-settings.json");
const SETTINGS_BACKUP = SETTINGS_PATH + ".testbak";

let getCardSettings: typeof import("./card-settings.js").getCardSettings;
let updateCardSettings: typeof import("./card-settings.js").updateCardSettings;
let deleteCardSettings: typeof import("./card-settings.js").deleteCardSettings;
let getAllCardSettings: typeof import("./card-settings.js").getAllCardSettings;
let hasCardSettings: typeof import("./card-settings.js").hasCardSettings;

beforeAll(async () => {
  if (existsSync(SETTINGS_PATH)) {
    copyFileSync(SETTINGS_PATH, SETTINGS_BACKUP);
  }
  const mod = await import("./card-settings.js");
  getCardSettings = mod.getCardSettings;
  updateCardSettings = mod.updateCardSettings;
  deleteCardSettings = mod.deleteCardSettings;
  getAllCardSettings = mod.getAllCardSettings;
  hasCardSettings = mod.hasCardSettings;
});

afterAll(() => {
  if (existsSync(SETTINGS_BACKUP)) {
    copyFileSync(SETTINGS_BACKUP, SETTINGS_PATH);
    unlinkSync(SETTINGS_BACKUP);
  } else if (existsSync(SETTINGS_PATH)) {
    unlinkSync(SETTINGS_PATH);
  }
});

describe("card-settings", () => {
  test("getCardSettings returns empty object for unknown card", () => {
    const settings = getCardSettings("nonexistent-card");
    expect(settings).toEqual({});
  });

  test("updateCardSettings stores and retrieves settings", () => {
    const result = updateCardSettings("sv06.5-036", { fontSize: 32 });
    expect(result.fontSize).toBe(32);

    const retrieved = getCardSettings("sv06.5-036");
    expect(retrieved.fontSize).toBe(32);
  });

  test("updateCardSettings merges with existing", () => {
    updateCardSettings("sv06.5-036", { fontSize: 32 });
    updateCardSettings("sv06.5-036", { maxCover: 0.4 });

    const settings = getCardSettings("sv06.5-036");
    expect(settings.fontSize).toBe(32);
    expect(settings.maxCover).toBe(0.4);
  });

  test("hasCardSettings returns correct boolean", () => {
    updateCardSettings("sv01-001", { fontSize: 36 });
    expect(hasCardSettings("sv01-001")).toBe(true);
    expect(hasCardSettings("nonexistent")).toBe(false);
  });

  test("deleteCardSettings removes settings", () => {
    updateCardSettings("to-delete", { fontSize: 28 });
    expect(hasCardSettings("to-delete")).toBe(true);

    const result = deleteCardSettings("to-delete");
    expect(result).toBe(true);
    expect(hasCardSettings("to-delete")).toBe(false);
    expect(getCardSettings("to-delete")).toEqual({});
  });

  test("deleteCardSettings returns false for nonexistent card", () => {
    expect(deleteCardSettings("never-existed")).toBe(false);
  });

  test("getAllCardSettings returns all entries", () => {
    updateCardSettings("card-a", { fontSize: 30 });
    updateCardSettings("card-b", { maxCover: 0.6 });

    const all = getAllCardSettings();
    expect(all["card-a"]?.fontSize).toBe(30);
    expect(all["card-b"]?.maxCover).toBe(0.6);
  });
});
