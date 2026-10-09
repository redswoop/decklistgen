import { describe, test, expect, beforeAll } from "bun:test";
import type { Card } from "../../shared/types/card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import { flattenDeck, runDeckHandSim, runDeckSetupSim, interpretHandSim } from "./deck-sim.js";
import { loadSet, getCard } from "./card-store.js";

function card(id: string, name: string, over: Partial<Card> = {}): Card {
  return {
    id, localId: id.split("-")[1], name, setCode: "T", setId: "t", setName: "T", era: "sv",
    imageBase: "", category: "Pokemon", stage: "Basic", rarity: "Common", energyTypes: [],
    isFullArt: false, isEx: false, isV: false, isVmax: false, isVstar: false, isAncient: false,
    isFuture: false, isTera: false, hasFoil: false, isPrintUnfriendly: false, mechanicsHash: "h",
    illustrator: "", ...over,
  };
}

const basic = card("t-1", "Pikachu");
const supporter = card("t-2", "Professor's Research", { category: "Trainer", trainerType: "Supporter", stage: undefined });
const energy = card("t-3", "Lightning Energy", { category: "Energy", mechanicsHash: "basic", stage: undefined, energyTypes: ["Lightning"] });

describe("flattenDeck", () => {
  test("expands counts into physical copies and drops zero-count entries", () => {
    const deck: DeckCard[] = [{ count: 2, card: basic }, { count: 0, card: supporter }, { count: 1, card: energy, artCard: basic }];
    const flat = flattenDeck(deck);
    expect(flat.map((c) => c.id)).toEqual(["t-1", "t-1", "t-3"]);
  });
});

describe("runDeckHandSim", () => {
  test("is deterministic under a seed and carries an interpretation", () => {
    const deck: DeckCard[] = [{ count: 12, card: basic }, { count: 12, card: supporter }, { count: 36, card: energy }];
    const a = runDeckHandSim(deck, { order: "first", iterations: 2000, seed: 5 });
    const b = runDeckHandSim(deck, { order: "first", iterations: 2000, seed: 5 });
    expect(a.stats.mulliganRate).toBe(b.stats.mulliganRate);
    expect(a.stats.deckSize).toBe(60);
    expect(a.interpretation.length).toBeGreaterThan(2);
    expect(a.interpretation.join(" ")).toContain("Mulligan rate");
  });

  test("interpretation flags an empty deck and a Basic-less deck", () => {
    expect(runDeckHandSim([], { order: "first" }).interpretation[0]).toContain("empty");
    const noBasics = runDeckHandSim([{ count: 60, card: energy }], { order: "first", iterations: 200 });
    expect(noBasics.interpretation.join(" ")).toContain("no Basic Pokémon");
  });

  test("interpretation warns on a high mulligan rate and off-size decks", () => {
    const lines = interpretHandSim({
      iterations: 1, deckSize: 59, handSize: 7, turns: 5, order: "first", mulliganRate: 0.3,
      avgMulligansPerGame: 0.4, noSupporterOrItemRate: 0.1, oddsBasic: 0.7, oddsBasicAndSupporter: 0.5,
      byCard: [], byCategory: { "Basic Pokémon": [0.7, 0.8, 0.9] }, infiniteMulligan: false,
    });
    expect(lines.join(" ")).toContain("59 cards");
    expect(lines.join(" ")).toContain("That's high");
  });
});

describe("runDeckSetupSim (real cached cards)", () => {
  beforeAll(async () => {
    await loadSet("SVI");
    await loadSet("SVE");
  });

  test("builds the Cacturne line from cached evolveFrom data and reports per-line odds", async () => {
    const cacnea = getCard("sv01-005")!;
    const cacturne = getCard("sv01-006")!;
    const nestBall = getCard("sv01-181")!;
    const grass = getCard("sve-001")!;
    expect(cacnea && cacturne && nestBall && grass).toBeTruthy();
    const deck: DeckCard[] = [
      { count: 4, card: cacnea },
      { count: 4, card: cacturne },
      { count: 4, card: nestBall },
      { count: 48, card: grass },
    ];
    const report = await runDeckSetupSim(deck, { order: "first", seed: 1, iterations: 300, turns: 4 });
    expect(report.deckSize).toBe(60);
    expect(report.turns).toBe(4);
    const line = report.lines.find((l) => l.line.finalName === "Cacturne");
    expect(line).toBeDefined();
    expect(line!.line.finalStage).toBe("Stage1");
    expect(line!.line.basicName).toBe("Cacnea");
    expect(line!.cantReason).toBeNull();
    expect(line!.result.cumulativeSetup).toHaveLength(4);
    // Nothing evolves on turn 1; by turn 4 a 4-4 line with Nest Ball should be up a decent fraction of the time.
    expect(line!.result.cumulativeSetup[0]).toBe(0);
    expect(line!.result.cumulativeSetup[3]).toBeGreaterThan(0.2);
    expect(line!.interpretation).toContain("Cacturne is in play");
    expect(report.interpretation.join(" ")).toContain("Going first");
  });

  test("lineIds restricts to the named lines and a missing Basic is reported as unsatisfiable", async () => {
    const cacturne = getCard("sv01-006")!;
    const pineco = getCard("sv01-001")!;
    const deck: DeckCard[] = [{ count: 4, card: cacturne }, { count: 4, card: pineco }, { count: 52, card: getCard("sve-001")! }];
    const report = await runDeckSetupSim(deck, { order: "second", seed: 1, iterations: 300, lineIds: ["cacturne"] });
    expect(report.lines).toHaveLength(1);
    expect(report.lines[0].cantReason).toContain("no Cacnea");
    expect(report.lines[0].result.unsatisfiable).toBe(true);
    expect(report.interpretation.join(" ")).toContain("Broken lines");
  });
});
