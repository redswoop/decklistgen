import { describe, expect, it } from "bun:test";
import type { CardTemplate, LoadedSet } from "../types/template.js";
import type { TcgdexCard } from "../types/card.js";
import { DEFAULT_SET_ID, resolveTemplate } from "./resolve-template.js";

function makeTemplate(id: string): CardTemplate {
  return { id, name: id, elements: [] };
}

function makeSet(
  id: string,
  opts: {
    slots?: Record<string, CardTemplate>;
    cards?: Record<string, CardTemplate>;
    extends?: string;
    origin?: "builtin" | "user";
  } = {},
): LoadedSet {
  return {
    manifest: { id, name: id, extends: opts.extends },
    origin: opts.origin ?? "builtin",
    slotTemplates: opts.slots ?? {},
    cardTemplates: opts.cards ?? {},
  };
}

function makeSets(...sets: LoadedSet[]): Map<string, LoadedSet> {
  return new Map(sets.map((s) => [s.manifest.id, s]));
}

const basicPokemon: TcgdexCard = {
  id: "sv4-1",
  localId: "1",
  name: "Pikachu",
  category: "Pokemon",
  stage: "Basic",
};

const trainer: TcgdexCard = {
  id: "sv4-99",
  localId: "99",
  name: "Boss's Orders",
  category: "Trainer",
};

describe("resolveTemplate", () => {
  it("returns slot template when set has it", () => {
    const sets = makeSets(makeSet(DEFAULT_SET_ID, {
      slots: { "pokemon-standard": makeTemplate("ps") },
    }));
    const r = resolveTemplate(basicPokemon, { globalSetId: DEFAULT_SET_ID }, sets);
    expect(r.template.id).toBe("ps");
    expect(r.matchKind).toBe("slot");
    expect(r.slot).toBe("pokemon-standard");
    expect(r.resolvedFromSetId).toBe(DEFAULT_SET_ID);
  });

  it("prefers card-specific template over slot template", () => {
    const sets = makeSets(makeSet(DEFAULT_SET_ID, {
      slots: { "pokemon-standard": makeTemplate("ps") },
      cards: { "sv4-1": makeTemplate("pikachu-custom") },
    }));
    const r = resolveTemplate(basicPokemon, { globalSetId: DEFAULT_SET_ID }, sets);
    expect(r.template.id).toBe("pikachu-custom");
    expect(r.matchKind).toBe("card");
  });

  it("walks extends chain when slot is missing", () => {
    const child = makeSet("child", { extends: DEFAULT_SET_ID, slots: { "trainer": makeTemplate("child-trainer") } });
    const parent = makeSet(DEFAULT_SET_ID, { slots: { "pokemon-standard": makeTemplate("parent-ps") } });
    const sets = makeSets(child, parent);
    const r = resolveTemplate(basicPokemon, { globalSetId: "child" }, sets);
    expect(r.template.id).toBe("parent-ps");
    expect(r.resolvedFromSetId).toBe(DEFAULT_SET_ID);
  });

  it("child slot wins over parent slot", () => {
    const child = makeSet("child", { extends: DEFAULT_SET_ID, slots: { "pokemon-standard": makeTemplate("child-ps") } });
    const parent = makeSet(DEFAULT_SET_ID, { slots: { "pokemon-standard": makeTemplate("parent-ps") } });
    const sets = makeSets(child, parent);
    const r = resolveTemplate(basicPokemon, { globalSetId: "child" }, sets);
    expect(r.template.id).toBe("child-ps");
    expect(r.resolvedFromSetId).toBe("child");
  });

  it("per-card setId overrides per-deck and global", () => {
    const setA = makeSet("a", { slots: { "trainer": makeTemplate("a-trainer") } });
    const setB = makeSet("b", { slots: { "trainer": makeTemplate("b-trainer") } });
    const setC = makeSet("c", { slots: { "trainer": makeTemplate("c-trainer") } });
    const fallback = makeSet(DEFAULT_SET_ID, { slots: { "trainer": makeTemplate("default-trainer") } });
    const sets = makeSets(setA, setB, setC, fallback);
    const r = resolveTemplate(trainer, { cardSetId: "a", deckSetId: "b", globalSetId: "c" }, sets);
    expect(r.template.id).toBe("a-trainer");
  });

  it("per-deck setId is used when per-card is absent", () => {
    const setB = makeSet("b", { slots: { "trainer": makeTemplate("b-trainer") } });
    const setC = makeSet("c", { slots: { "trainer": makeTemplate("c-trainer") } });
    const sets = makeSets(setB, setC, makeSet(DEFAULT_SET_ID, { slots: { "trainer": makeTemplate("d-trainer") } }));
    const r = resolveTemplate(trainer, { deckSetId: "b", globalSetId: "c" }, sets);
    expect(r.template.id).toBe("b-trainer");
  });

  it("falls back to default set when chain is exhausted", () => {
    const child = makeSet("child", { extends: undefined });
    const fallback = makeSet(DEFAULT_SET_ID, { slots: { "pokemon-standard": makeTemplate("default-ps") } });
    const sets = makeSets(child, fallback);
    const r = resolveTemplate(basicPokemon, { globalSetId: "child" }, sets);
    expect(r.template.id).toBe("default-ps");
    expect(r.resolvedFromSetId).toBe(DEFAULT_SET_ID);
  });

  it("detects extends cycles", () => {
    const a = makeSet("a", { extends: "b" });
    const b = makeSet("b", { extends: "a" });
    const sets = makeSets(a, b);
    expect(() => resolveTemplate(basicPokemon, { globalSetId: "a" }, sets)).toThrow(/cycle/i);
  });

  it("throws when no template is available anywhere", () => {
    const sets = makeSets(makeSet(DEFAULT_SET_ID));
    expect(() => resolveTemplate(basicPokemon, { globalSetId: DEFAULT_SET_ID }, sets)).toThrow(/No template/);
  });

  it("falls back to default when the requested set is unknown", () => {
    const sets = makeSets(makeSet(DEFAULT_SET_ID, { slots: { "pokemon-standard": makeTemplate("d") } }));
    const r = resolveTemplate(basicPokemon, { globalSetId: "missing" }, sets);
    expect(r.template.id).toBe("d");
  });

  it("slotOverride bypasses suggestTemplate", () => {
    const sets = makeSets(makeSet(DEFAULT_SET_ID, {
      slots: {
        "pokemon-standard": makeTemplate("ps"),
        "pokemon-fullart": makeTemplate("pf"),
      },
    }));
    // basicPokemon would normally resolve to pokemon-standard; override to fullart.
    const r = resolveTemplate(basicPokemon, { globalSetId: DEFAULT_SET_ID, slotOverride: "pokemon-fullart" }, sets);
    expect(r.template.id).toBe("pf");
    expect(r.slot).toBe("pokemon-fullart");
  });

  it("card-specific match still wins over slotOverride", () => {
    const sets = makeSets(makeSet(DEFAULT_SET_ID, {
      slots: { "pokemon-fullart": makeTemplate("pf") },
      cards: { "sv4-1": makeTemplate("custom") },
    }));
    const r = resolveTemplate(basicPokemon, { globalSetId: DEFAULT_SET_ID, slotOverride: "pokemon-fullart" }, sets);
    expect(r.template.id).toBe("custom");
    expect(r.matchKind).toBe("card");
  });
});
