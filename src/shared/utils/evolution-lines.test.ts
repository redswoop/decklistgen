import { describe, it, expect } from "bun:test";
import { buildEvolutionLines, pickAutoTargets, normStage, type SimCard } from "./evolution-lines.js";
import type { Card } from "../types/card.js";

let idc = 0;
function mk(partial: Partial<SimCard> & { name: string; stage?: string }): SimCard {
  return {
    id: `${partial.name}-${idc++}`,
    localId: "1",
    name: partial.name,
    imageBase: "",
    category: partial.category ?? "Pokemon",
    rarity: "Common",
    energyTypes: [],
    setId: "x",
    setCode: "X",
    setName: "X",
    era: "sv",
    stage: partial.stage,
    isFullArt: false,
    isEx: false,
    isV: false,
    isVmax: false,
    isVstar: false,
    isAncient: false,
    isFuture: false,
    isTera: false,
    hasFoil: false,
    isPrintUnfriendly: false,
    mechanicsHash: "x",
    illustrator: "",
    ...partial,
  } as SimCard;
}

/** Expand a {card, n} list into a flattened deck. */
function deck(...entries: Array<{ c: SimCard; n: number }>): SimCard[] {
  return entries.flatMap(({ c, n }) => Array.from({ length: n }, () => ({ ...c, id: `${c.id}-${idc++}` })));
}

describe("normStage", () => {
  it("maps stages, defaulting blanks to Basic and VMAX/VSTAR to Stage1", () => {
    expect(normStage("Basic")).toBe("Basic");
    expect(normStage(undefined)).toBe("Basic");
    expect(normStage("Stage1")).toBe("Stage1");
    expect(normStage("Stage2")).toBe("Stage2");
    expect(normStage("VMAX")).toBe("Stage1");
    expect(normStage("VSTAR")).toBe("Stage1");
  });
});

describe("buildEvolutionLines", () => {
  it("builds a full Basic→Stage1→Stage2 line", () => {
    const cards = deck(
      { c: mk({ name: "Charmander", stage: "Basic", chain: ["Charmander"] }), n: 4 },
      { c: mk({ name: "Charmeleon", stage: "Stage1", chain: ["Charmander", "Charmeleon"] }), n: 2 },
      { c: mk({ name: "Charizard ex", stage: "Stage2", isEx: true, chain: ["Charmander", "Charmeleon", "Charizard ex"] }), n: 3 },
    );
    const { lines } = buildEvolutionLines(cards);
    expect(lines).toHaveLength(1);
    const l = lines[0];
    expect(l.finalName).toBe("Charizard ex");
    expect(l.finalStage).toBe("Stage2");
    expect(l.basicName).toBe("Charmander");
    expect(l.stage1Name).toBe("Charmeleon");
    expect(l.basicCopies).toBe(4);
    expect(l.stage1Copies).toBe(2);
    expect(l.finalCopies).toBe(3);
    expect(l.requiresRareCandy).toBe(false);
    expect(l.isExLine).toBe(true);
  });

  it("collapses multiple printings of the same name and sums copies", () => {
    const cards = [
      mk({ name: "Charmander", stage: "Basic", chain: ["Charmander"] }),
      mk({ name: "Charmander", stage: "Basic", chain: ["Charmander"] }),
      mk({ name: "Charizard ex", stage: "Stage2", isEx: true, chain: ["Charmander", "Charmeleon", "Charizard ex"] }),
    ];
    const { lines } = buildEvolutionLines(cards);
    expect(lines[0].basicCopies).toBe(2);
  });

  it("treats a Rare-Candy line (no Stage 1 in deck) as valid but flagged", () => {
    const cards = deck(
      { c: mk({ name: "Charmander", stage: "Basic", chain: ["Charmander"] }), n: 4 },
      { c: mk({ name: "Charizard ex", stage: "Stage2", isEx: true, chain: ["Charmander", "Charmeleon", "Charizard ex"] }), n: 3 },
    );
    const { lines } = buildEvolutionLines(cards);
    expect(lines).toHaveLength(1);
    expect(lines[0].basicName).toBe("Charmander");
    expect(lines[0].stage1Name).toBeNull();
    expect(lines[0].stage1Copies).toBe(0);
    expect(lines[0].requiresRareCandy).toBe(true);
    expect(lines[0].warnings).toHaveLength(0); // not a hard warning — Candy bridges it
  });

  it("warns when a Stage 2's chain is unresolved (no basic known)", () => {
    const cards = deck(
      { c: mk({ name: "Mega Scrafty ex", stage: "Stage2", isEx: true, chain: ["Mega Scrafty ex"] }), n: 2 },
    );
    const { lines, warnings } = buildEvolutionLines(cards);
    expect(lines[0].basicName).toBeNull();
    expect(warnings.some((w) => w.kind === "missing-evolve-from")).toBe(true);
  });

  it("warns when a higher stage has no Basic in the deck", () => {
    const cards = deck(
      { c: mk({ name: "Charizard ex", stage: "Stage2", isEx: true, chain: ["Charmander", "Charmeleon", "Charizard ex"] }), n: 2 },
    );
    const { lines, warnings } = buildEvolutionLines(cards);
    expect(lines[0].basicCopies).toBe(0);
    expect(warnings.some((w) => w.kind === "no-basic")).toBe(true);
  });

  it("treats a single-stage Basic-ex as its own line", () => {
    const cards = deck({ c: mk({ name: "Okidogi ex", stage: "Basic", isEx: true, chain: ["Okidogi ex"] }), n: 3 });
    const { lines } = buildEvolutionLines(cards);
    expect(lines).toHaveLength(1);
    expect(lines[0].finalStage).toBe("Basic");
    expect(lines[0].basicName).toBe("Okidogi ex");
    expect(lines[0].requiresRareCandy).toBe(false);
  });

  it("does not list a Basic that evolves into an in-deck higher stage as its own line", () => {
    const cards = deck(
      { c: mk({ name: "Bidoof", stage: "Basic", chain: ["Bidoof"] }), n: 2 },
      { c: mk({ name: "Bibarel", stage: "Stage1", chain: ["Bidoof", "Bibarel"] }), n: 2 },
    );
    const { lines } = buildEvolutionLines(cards);
    expect(lines).toHaveLength(1);
    expect(lines[0].finalName).toBe("Bibarel");
  });
});

describe("pickAutoTargets", () => {
  it("ranks Stage2-ex above a plain Stage1 and a support basic", () => {
    const cards = deck(
      { c: mk({ name: "Charmander", stage: "Basic", chain: ["Charmander"] }), n: 4 },
      { c: mk({ name: "Charizard ex", stage: "Stage2", isEx: true, chain: ["Charmander", "Charmeleon", "Charizard ex"] }), n: 3 },
      { c: mk({ name: "Bidoof", stage: "Basic", chain: ["Bidoof"] }), n: 2 },
      { c: mk({ name: "Bibarel", stage: "Stage1", chain: ["Bidoof", "Bibarel"] }), n: 2 },
      { c: mk({ name: "Lumineon V", stage: "Basic", isV: true, chain: ["Lumineon V"] }), n: 1 },
    );
    const analysis = buildEvolutionLines(cards);
    const targets = pickAutoTargets(analysis);
    expect(targets[0].finalName).toBe("Charizard ex");
    // Bibarel (Stage1) outranks the lone basic Lumineon V? No — Basic-ex/V scores 200 > Stage1 150.
    expect(targets[1].finalName).toBe("Lumineon V");
  });
});
