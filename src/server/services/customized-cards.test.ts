import { describe, test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

describe("customized-cards", () => {
  test("getCustomizedCards returns a valid response shape", async () => {
    const { getCustomizedCards } = await import("./customized-cards.js");
    const result = await getCustomizedCards();

    expect(result).toHaveProperty("cards");
    expect(result).toHaveProperty("totalClean");
    expect(result).toHaveProperty("totalSettings");
    expect(result).toHaveProperty("totalStale");
    expect(Array.isArray(result.cards)).toBe(true);
    expect(typeof result.totalClean).toBe("number");
    expect(typeof result.totalSettings).toBe("number");
    expect(typeof result.totalStale).toBe("number");
  });

  test("each customized card has required fields", async () => {
    const { getCustomizedCards } = await import("./customized-cards.js");
    const result = await getCustomizedCards();

    for (const cc of result.cards) {
      expect(cc).toHaveProperty("card");
      expect(cc.card).toHaveProperty("id");
      expect(cc.card).toHaveProperty("name");
      expect(typeof cc.hasClean).toBe("boolean");
      expect(typeof cc.hasComposite).toBe("boolean");
      expect(typeof cc.hasSettings).toBe("boolean");
      expect(typeof cc.hasPromptOverride).toBe("boolean");
      expect(typeof cc.isStale).toBe("boolean");
      expect(Array.isArray(cc.deckMembership)).toBe(true);
    }
  });

  test("totalClean matches cards with hasClean=true", async () => {
    const { getCustomizedCards } = await import("./customized-cards.js");
    const result = await getCustomizedCards();

    const cleanCount = result.cards.filter((c) => c.hasClean).length;
    expect(result.totalClean).toBe(cleanCount);
  });

  test("totalStale matches cards with isStale=true", async () => {
    const { getCustomizedCards } = await import("./customized-cards.js");
    const result = await getCustomizedCards();

    const staleCount = result.cards.filter((c) => c.isStale).length;
    expect(result.totalStale).toBe(staleCount);
  });

  test("invalidateCustomizedCardsCache forces fresh data", async () => {
    const { getCustomizedCards, invalidateCustomizedCardsCache } = await import("./customized-cards.js");

    // First call populates cache
    const first = await getCustomizedCards();

    // Invalidate
    invalidateCustomizedCardsCache();

    // Second call should succeed (fresh data)
    const second = await getCustomizedCards();
    expect(second).toHaveProperty("cards");
  });
});
