import { describe, test, expect, beforeAll } from "bun:test";
import { parsePtcgoText } from "./limitless.js";
import { loadSet, findCardBySetAndNumber, findCardByName, getVariants } from "./card-store.js";
import { getRarityRank, getTopRarityVariants } from "../../shared/utils/rarity-rank.js";
import { SET_MAP } from "../../shared/constants/set-codes.js";

const DECK_PASTE = `Pokémon: 18
3 Ralts MEG 58
1 Kirlia MEG 59
2 Gardevoir ex SVI 86
3 Munkidori TWM 95
2 Frillish WHT 44
1 Jellicent ex WHT 45
1 Mew ex MEW 151
1 Lillie's Clefairy ex JTG 56
1 Fezandipiti ex SFA 38
1 Scream Tail PAR 86
1 Mega Diancie ex PFL 41
1 Latias ex SSP 76

Trainer: 32
4 Lillie's Determination MEG 119
4 Iono PAL 185
1 Professor Turo's Scenario PAR 171
1 Professor's Research JTG 155
4 Ultra Ball MEG 131
3 Earthen Vessel PAR 163
3 Rare Candy MEG 125
2 Nest Ball SVI 181
2 Night Stretcher SFA 61
2 Counter Catcher PAR 160
1 Secret Box TWM 163
1 Super Rod PAL 188
2 Bravery Charm PAL 173
1 Mystery Garden MEG 122
1 Artazon PAL 171

Energy: 10
7 Psychic Energy MEE 5
3 Darkness Energy MEE 7`;

describe("Parser: handles section headers with counts", () => {
  test("parses the full deck paste correctly", () => {
    const result = parsePtcgoText(DECK_PASTE);
    expect(result.pokemon).toHaveLength(12);
    expect(result.trainer).toHaveLength(15);
    expect(result.energy).toHaveLength(2);

    const pokemonCount = result.pokemon.reduce((s, c) => s + c.count, 0);
    const trainerCount = result.trainer.reduce((s, c) => s + c.count, 0);
    const energyCount = result.energy.reduce((s, c) => s + c.count, 0);
    expect(pokemonCount).toBe(18);
    expect(trainerCount).toBe(32);
    expect(energyCount).toBe(10);
  });
});

describe("Beautify with isPrintUnfriendly filter", () => {
  const parsed = parsePtcgoText(DECK_PASTE);
  const allCards = [...parsed.pokemon, ...parsed.trainer, ...parsed.energy];

  beforeAll(async () => {
    for (const code of Object.keys(SET_MAP)) {
      try { await loadSet(code); } catch {}
    }
  }, 120_000);

  test("gold trainer items are marked isPrintUnfriendly", () => {
    // Nest Ball SVI 255 is Hyper Rare Item
    const nestBallGold = findCardBySetAndNumber("SVI", "255");
    expect(nestBallGold).toBeDefined();
    expect(nestBallGold!.isPrintUnfriendly).toBe(true);

    // Counter Catcher PAR 264 is Hyper Rare Item
    const counterCatcherGold = findCardBySetAndNumber("PAR", "264");
    expect(counterCatcherGold).toBeDefined();
    expect(counterCatcherGold!.isPrintUnfriendly).toBe(true);
  });

  test("gold Pokemon ex are NOT isPrintUnfriendly", () => {
    // Mew ex MEW 205 is Hyper Rare Pokemon
    const mewGold = findCardBySetAndNumber("MEW", "205");
    expect(mewGold).toBeDefined();
    expect(mewGold!.isPrintUnfriendly).toBe(false);

    // Charizard ex OBF 228 is Hyper Rare Pokemon
    const charizardGold = findCardBySetAndNumber("OBF", "228");
    expect(charizardGold).toBeDefined();
    expect(charizardGold!.isPrintUnfriendly).toBe(false);
  });

  test("Artazon gold is overridden to print-friendly", () => {
    // sv03-229 = Artazon Hyper Rare (stadium, but has real artwork)
    const artazonGold = findCardBySetAndNumber("OBF", "229");
    expect(artazonGold).toBeDefined();
    expect(artazonGold!.isPrintUnfriendly).toBe(false);
  });

  test("SWSH rainbow supporters are isPrintUnfriendly", () => {
    // Marnie SWSH 208 is Secret Rare Supporter
    const marnieRainbow = findCardBySetAndNumber("SWSH", "208");
    expect(marnieRainbow).toBeDefined();
    expect(marnieRainbow!.isPrintUnfriendly).toBe(true);
  });

  test("normal trainers are NOT isPrintUnfriendly", () => {
    const nestBall = findCardBySetAndNumber("SVI", "181");
    expect(nestBall).toBeDefined();
    expect(nestBall!.isPrintUnfriendly).toBe(false);
  });

  test("all rarities have non-zero rank", () => {
    const parsed2 = parsePtcgoText(DECK_PASTE);
    const all = [...parsed2.pokemon, ...parsed2.trainer, ...parsed2.energy];
    for (const entry of all) {
      const card = findCardBySetAndNumber(entry.set, entry.number)
        ?? findCardByName(entry.name);
      if (!card) continue;
      const variants = getVariants(card.id);
      for (const v of variants) {
        const rank = getRarityRank(v.rarity);
        if (v.rarity !== "Unknown" && v.rarity !== "None") {
          expect(rank).toBeGreaterThan(0);
        }
      }
    }
  });

  test("beautify best mode with print filter finds print-friendly variants", () => {
    for (const entry of allCards) {
      const card = findCardBySetAndNumber(entry.set, entry.number)
        ?? findCardByName(entry.name);
      if (!card) continue;

      const originalRank = getRarityRank(card.rarity);
      const variants = getVariants(card.id).filter((v) => !v.isPrintUnfriendly);
      if (variants.length === 0) continue;

      const topVariants = getTopRarityVariants(variants);
      const topRank = topVariants.length > 0 ? getRarityRank(topVariants[0].rarity) : 0;

      // If original is print-friendly, we shouldn't downgrade
      // If original is print-unfriendly, any print-friendly variant is an improvement
      if (!card.isPrintUnfriendly) {
        expect(topRank).toBeGreaterThanOrEqual(originalRank);
      }

      const upgraded = topRank > originalRank;
      const isAceSpec = card.rarity.toLowerCase().includes("ace spec");
      const isOriginalUnfriendly = card.isPrintUnfriendly;
      if (!upgraded && !isAceSpec && !isOriginalUnfriendly) {
        console.log(`  ⚠ No upgrade: ${entry.name} — ${card.rarity} (rank ${originalRank}), ${variants.length} print-friendly variants`);
      }
    }
  }, 30_000);
});
