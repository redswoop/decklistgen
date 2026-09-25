import { describe, it, expect } from "bun:test";
import type { Card } from "../types/card.js";
import {
  printCategoryOf,
  printCategoryLabel,
  PRINT_CATEGORY_ORDER,
  fullPrintCounts,
  oneEachPrintCounts,
  resolvePrintCounts,
  setPrintCount,
  setPrintGroup,
  printGroupState,
  totalPrintCopies,
  sinceLastPrintCounts,
  encodePrintCounts,
  decodePrintCounts,
} from "./print-plan.js";

function card(p: Partial<Card>): Card {
  return {
    id: "x-1",
    name: "Card",
    setCode: "x",
    setName: "X",
    localId: "1",
    category: "Pokemon",
    rarity: "Common",
    energyTypes: [],
    mechanicsHash: "abc",
    ...p,
  } as Card;
}

const entries = [
  { id: "a", deckCount: 4 },
  { id: "b", deckCount: 2 },
  { id: "c", deckCount: 1 },
];

describe("printCategoryOf", () => {
  it("buckets every card into exactly one print filter", () => {
    expect(printCategoryOf(card({ category: "Pokemon" }))).toBe("pokemon");
    expect(printCategoryOf(card({ category: "Trainer", trainerType: "Supporter" }))).toBe("supporters");
    expect(printCategoryOf(card({ category: "Trainer", trainerType: "Item" }))).toBe("items");
    expect(printCategoryOf(card({ category: "Trainer", trainerType: "Tool" }))).toBe("tools");
    expect(printCategoryOf(card({ category: "Trainer", trainerType: "Stadium" }))).toBe("stadiums");
    expect(printCategoryOf(card({ category: "Trainer" }))).toBe("other");
    expect(printCategoryOf(card({ category: "Energy", mechanicsHash: "basic" }))).toBe("basicenergy");
    expect(printCategoryOf(card({ category: "Energy", mechanicsHash: "jet" }))).toBe("specialenergy");
  });

  it("has a label and an order slot for every category", () => {
    for (const c of PRINT_CATEGORY_ORDER) expect(printCategoryLabel(c)).toBeTruthy();
    expect(PRINT_CATEGORY_ORDER[0]).toBe("pokemon");
    expect(PRINT_CATEGORY_ORDER.indexOf("basicenergy")).toBeGreaterThan(PRINT_CATEGORY_ORDER.indexOf("specialenergy"));
  });
});

describe("plan builders", () => {
  it("fullPrintCounts mirrors the deck", () => {
    expect(fullPrintCounts(entries)).toEqual({ a: 4, b: 2, c: 1 });
  });

  it("oneEachPrintCounts prints one of each present card", () => {
    expect(oneEachPrintCounts([...entries, { id: "z", deckCount: 0 }])).toEqual({ a: 1, b: 1, c: 1, z: 0 });
  });

  it("resolvePrintCounts drops stale ids, defaults missing ones, and clamps", () => {
    const r = resolvePrintCounts(entries, { a: 99, b: -3, gone: 2, c: 1.7 });
    expect(r).toEqual({ a: 4, b: 0, c: 1 });
    expect(resolvePrintCounts(entries, {})).toEqual({ a: 4, b: 2, c: 1 });
  });
});

describe("setPrintCount / setPrintGroup", () => {
  it("clamps a single card to [0, deckCount] and never mutates", () => {
    const base = fullPrintCounts(entries);
    const up = setPrintCount(base, entries, "b", 5);
    expect(up.b).toBe(2);
    const down = setPrintCount(base, entries, "b", -1);
    expect(down.b).toBe(0);
    expect(base.b).toBe(2);
    expect(setPrintCount(base, entries, "nope", 1)).toBe(base);
  });

  it("sets a group to full or zero, ignoring ids outside the deck", () => {
    const base = fullPrintCounts(entries);
    const off = setPrintGroup(base, entries, ["a", "c", "ghost"], false);
    expect(off).toEqual({ a: 0, b: 2, c: 0 });
    const on = setPrintGroup(off, entries, ["a"], true);
    expect(on).toEqual({ a: 4, b: 2, c: 0 });
  });
});

describe("printGroupState", () => {
  it("reports all / none / mixed / empty", () => {
    const full = fullPrintCounts(entries);
    expect(printGroupState(full, entries, ["a", "b"])).toBe("all");
    expect(printGroupState({ a: 0, b: 0, c: 1 }, entries, ["a", "b"])).toBe("none");
    expect(printGroupState({ a: 1, b: 2, c: 1 }, entries, ["a", "b"])).toBe("mixed");
    expect(printGroupState({ a: 4, b: 0, c: 1 }, entries, ["a", "b"])).toBe("mixed");
    expect(printGroupState(full, entries, [])).toBe("empty");
    expect(printGroupState(full, entries, ["ghost"])).toBe("empty");
  });
});

describe("totals and deltas", () => {
  it("totalPrintCopies sums the plan", () => {
    expect(totalPrintCopies({ a: 4, b: 0, c: 1 })).toBe(5);
    expect(totalPrintCopies({})).toBe(0);
  });

  it("sinceLastPrintCounts prints only what grew since the last print", () => {
    const last = { a: 4, b: 1, c: 3 };
    expect(sinceLastPrintCounts(entries, last)).toEqual({ a: 0, b: 1, c: 0 });
    // Never printed → everything prints.
    expect(sinceLastPrintCounts(entries, {})).toEqual({ a: 4, b: 2, c: 1 });
  });
});

describe("counts URL encoding", () => {
  it("encodes only cards that differ from the deck count", () => {
    expect(encodePrintCounts(fullPrintCounts(entries), entries)).toBe("");
    expect(encodePrintCounts({ a: 4, b: 0, c: 1 }, entries)).toBe("b:0");
    expect(encodePrintCounts({ a: 2, b: 0, c: 1 }, entries)).toBe("a:2,b:0");
  });

  it("round-trips through decodePrintCounts, tolerating dotted set ids", () => {
    const dotted = [{ id: "sv06.5-036", deckCount: 3 }, { id: "swsh12-190", deckCount: 2 }];
    const enc = encodePrintCounts({ "sv06.5-036": 1, "swsh12-190": 0 }, dotted);
    expect(enc).toBe("sv06.5-036:1,swsh12-190:0");
    expect(decodePrintCounts(enc)).toEqual({ "sv06.5-036": 1, "swsh12-190": 0 });
  });

  it("ignores malformed pairs", () => {
    expect(decodePrintCounts("a:1,junk,:3,b:-1,c:x,d:2")).toEqual({ a: 1, d: 2 });
    expect(decodePrintCounts("")).toEqual({});
    expect(decodePrintCounts(null)).toEqual({});
  });
});
