import { describe, test, expect, beforeAll } from "bun:test";
import { loadSet, getVariants, getCard, findCardBySetAndNumber, getFilterOptions } from "./card-store.js";
import { EFFECT_TAGS } from "../../shared/utils/effect-tags.js";
import { IMAGE_STAND_INS } from "./image-stand-ins.js";
import { getCardDetail } from "./card-detail.js";

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

  test("Classic Collection cards borrow their original printing's scan", () => {
    // TCGdex ships 30th-c with no `image`; all 30 cards must map to a stand-in.
    for (let n = 1; n <= 30; n++) {
      const id = `30th-c-${String(n).padStart(3, "0")}`;
      const card = getCard(id);
      expect(card, id).toBeDefined();
      expect(IMAGE_STAND_INS[id], id).toBeDefined();
      expect(card!.imageBase, id).toBe(IMAGE_STAND_INS[id]);
    }
    expect(getCard("30th-c-001")?.imageBase).toBe("https://assets.tcgdex.net/en/base/base1/4");
  });

  test("leaked TCGdex HTML is scrubbed from detail text", async () => {
    // Pikachu & Zekrom-GX ships with <span class="energy-symbol"> and <em>.
    const detail = await getCardDetail("30th-c-008");
    const tagBolt = detail?.attacks.find((a) => a.name.startsWith("Tag Bolt"));
    expect(tagBolt?.effect).toContain("3 extra {L} Energy");
    expect(tagBolt?.effect).toContain("(in addition to this attack's cost)");
    for (const a of detail?.attacks ?? []) expect(a.effect ?? "").not.toMatch(/<[a-z/]/);
    for (const a of detail?.abilities ?? []) expect(a.effect).not.toMatch(/<[a-z/]/);
  });

  test("an upstream image still beats the stand-in", () => {
    // 30th-001 (main set) has a real TCGdex image and no stand-in entry.
    expect(IMAGE_STAND_INS["30th-001"]).toBeUndefined();
    expect(getCard("30th-001")?.imageBase).toBe("https://assets.tcgdex.net/en/me/30th/001");
  });
});

describe("function tags", () => {
  beforeAll(async () => {
    // SSP has tagged Supporters/Items plus untagged Tools; 30C has the text-less
    // Ultra Ball reprint and SVI a printing that carries the effect text.
    await loadSet("SSP");
    await loadSet("30C");
    await loadSet("SVI");
  }, 120_000);

  test("Supporters and Items are stamped from their effect text", () => {
    expect(getCard("sv08-170")?.name).toBe("Cyrano");
    expect(getCard("sv08-170")?.effectTags).toEqual(["search:pokemon"]);
    expect(getCard("sv08-186")?.name).toBe("Scramble Switch");
    expect(getCard("sv08-186")?.effectTags).toEqual(["switch", "energy-move"]);
  });

  test("every printing of a card carries the same tags", () => {
    expect(getCard("sv08-179")?.effectTags).toEqual(["gust"]);
    expect(getCard("sv08-234")?.effectTags).toEqual(["gust"]);
    expect(getCard("sv08-246")?.effectTags).toEqual(["gust"]);
  });

  test("untagged cards have no effectTags field at all", () => {
    expect(getCard("sv08-169")?.name).toBe("Counter Gain"); // a Tool
    expect(getCard("sv08-169")).not.toHaveProperty("effectTags");
    expect(getCard("sv08-238")).not.toHaveProperty("effectTags"); // Pikachu ex
  });

  test("a reprint shipped without effect text borrows a same-name printing's tags", () => {
    expect(getCard("30th-128")?.name).toBe("Ultra Ball");
    expect(getCard("30th-128")?.effectTags).toEqual(["search:pokemon"]);
    expect(getCard("30th-127")?.name).toBe("Switch");
    expect(getCard("30th-127")?.effectTags).toEqual(["switch"]);
  });

  test("getFilterOptions lists the tags in play, in registry order", () => {
    const { effectTags } = getFilterOptions();
    expect(effectTags).toContain("gust");
    expect(effectTags).toContain("search:pokemon");
    const registryOrder = EFFECT_TAGS.map((t) => t.id).filter((id) => effectTags.includes(id));
    expect(effectTags).toEqual(registryOrder);
  });
});
