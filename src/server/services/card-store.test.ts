import { describe, test, expect, beforeAll } from "bun:test";
import { loadSet, getVariants, getCard, findCardBySetAndNumber } from "./card-store.js";

describe("getVariants — cross-set/era reprints", () => {
  beforeAll(async () => {
    // Load every set that contains a Pikachu ex print sharing the SSP gameplay
    // (mechanicsHash 34c2e9c0): SSP itself, the PRE reprint, and the ASC (ME)
    // reprints. All three set listings + card bodies must be present in
    // /cache for this test to run offline.
    await loadSet("SSP");
    await loadSet("PRE");
    await loadSet("ASC");
  });

  test("Pikachu ex SSP 238 lists every cross-era reprint sharing its mechanics hash", () => {
    const seed = getCard("sv08-238");
    expect(seed).toBeDefined();

    const variants = getVariants("sv08-238");
    const ids = variants.map((v) => v.id).sort();

    // 4 SSP prints + 1 PRE hyper rare + 2 ASC (ME) reprints = 7 total
    expect(ids).toEqual([
      "me02.5-057",
      "me02.5-277",
      "sv08-057",
      "sv08-219",
      "sv08-238",
      "sv08-247",
      "sv08.5-179",
    ]);

    // All variants share the seed's mechanicsHash
    for (const v of variants) {
      expect(v.mechanicsHash).toBe(seed!.mechanicsHash);
      expect(v.name).toBe("Pikachu ex");
    }
  });
});

describe("30th anniversary sets", () => {
  beforeAll(async () => {
    // Set listings + card bodies must be present in /cache to run offline.
    await loadSet("30C");
    await loadSet("30CC");
  }, 120_000);

  test("main set cards land in the Mega Evolution era under 30C", () => {
    const card = findCardBySetAndNumber("30C", "149");
    expect(card?.id).toBe("30th-149");
    expect(card?.name).toBe("Pikachu ex");
    expect(card?.era).toBe("me");
    expect(card?.setCode).toBe("30C");
  });

  test("Limitless-style CC numbers resolve to the Classic Collection", () => {
    const card = findCardBySetAndNumber("30C", "CC1");
    expect(card?.id).toBe("30th-c-001");
    expect(card?.name).toBe("Charizard");
    expect(card?.setCode).toBe("30CC");
    expect(card?.era).toBe("me");
  });
});
