import { describe, it, expect } from "bun:test";
import {
  runSetupSim,
  simulateOneGame,
  nextNeededPiece,
  pickDiscards,
  doEvolutions,
  benchLineBasic,
  type GameState,
} from "./setup-sim.js";
import { buildEvolutionLines, type SimCard, type EvolutionLine } from "./evolution-lines.js";
import { makeRng } from "./hand-sim.js";

let idc = 0;
function mk(partial: Partial<SimCard> & { name: string }): SimCard {
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

function copies(c: SimCard, n: number): SimCard[] {
  return Array.from({ length: n }, () => ({ ...c, id: `${c.id}-${idc++}` }));
}

// Stock pieces for a Charmander → Charizard ex line.
const charmander = () => mk({ name: "Charmander", stage: "Basic", chain: ["Charmander"] });
const charmeleon = () => mk({ name: "Charmeleon", stage: "Stage1", chain: ["Charmander", "Charmeleon"] });
const charizard = () => mk({ name: "Charizard ex", stage: "Stage2", isEx: true, chain: ["Charmander", "Charmeleon", "Charizard ex"] });
const rareCandy = () => mk({ name: "Rare Candy", category: "Trainer", trainerType: "Item", chain: undefined });
const filler = () => mk({ name: "Filler Energy", category: "Energy", chain: undefined });

function lineFor(deck: SimCard[], finalName = "Charizard ex"): EvolutionLine {
  const l = buildEvolutionLines(deck).lines.find((x) => x.finalName === finalName);
  if (!l) throw new Error(`no line for ${finalName}`);
  return l;
}

function emptyState(over: Partial<GameState> = {}): GameState {
  return { hand: [], deck: [], discard: [], bench: [], turn: 1, order: "first", supporterUsed: false, ...over };
}

describe("doEvolutions — timing", () => {
  it("does not evolve on the first turn", () => {
    const deck = [...copies(charmander(), 4), ...copies(charizard(), 3), ...copies(rareCandy(), 4)];
    const line = lineFor(deck);
    const state = emptyState({
      turn: 1,
      bench: [{ name: "Charmander", enteredTurn: 1 }],
      hand: [rareCandy(), charizard()],
    });
    doEvolutions(state, line, []);
    expect(state.bench[0].name).toBe("Charmander");
  });

  it("does not evolve a Pokémon the turn it entered play", () => {
    const deck = [...copies(charmander(), 4), ...copies(charizard(), 3), ...copies(rareCandy(), 4)];
    const line = lineFor(deck);
    const state = emptyState({
      turn: 2,
      bench: [{ name: "Charmander", enteredTurn: 2 }], // just benched this turn
      hand: [rareCandy(), charizard()],
    });
    doEvolutions(state, line, []);
    expect(state.bench[0].name).toBe("Charmander");
  });

  it("Rare-Candy evolves Basic straight to Stage 2 when eligible", () => {
    const deck = [...copies(charmander(), 4), ...copies(charizard(), 3), ...copies(rareCandy(), 4)];
    const line = lineFor(deck);
    const log: string[] = [];
    const state = emptyState({
      turn: 2,
      bench: [{ name: "Charmander", enteredTurn: 1 }],
      hand: [rareCandy(), charizard()],
    });
    doEvolutions(state, line, log);
    expect(state.bench[0].name).toBe("Charizard ex");
    expect(log.some((l) => l.includes("Rare Candy"))).toBe(true);
  });

  it("uses the Stage-1 step when no Rare Candy is around", () => {
    const deck = [...copies(charmander(), 4), ...copies(charmeleon(), 2), ...copies(charizard(), 3)];
    const line = lineFor(deck);
    const state = emptyState({
      turn: 2,
      bench: [{ name: "Charmander", enteredTurn: 1 }],
      hand: [charmeleon(), charizard()],
    });
    doEvolutions(state, line, []);
    expect(state.bench[0].name).toBe("Charmeleon");
  });
});

describe("nextNeededPiece", () => {
  const deck = [...copies(charmander(), 4), ...copies(charmeleon(), 2), ...copies(charizard(), 3)];
  const line = lineFor(deck);

  it("needs a Basic when nothing is in play", () => {
    expect(nextNeededPiece(emptyState(), line)).toEqual({ kind: "basic", name: "Charmander" });
  });
  it("needs the Stage 1 once the Basic is in play (no Candy)", () => {
    const state = emptyState({ bench: [{ name: "Charmander", enteredTurn: 1 }] });
    expect(nextNeededPiece(state, line)).toEqual({ kind: "stage1", name: "Charmeleon" });
  });
  it("needs the final card once the Stage 1 is in play", () => {
    const state = emptyState({ bench: [{ name: "Charmeleon", enteredTurn: 1 }] });
    expect(nextNeededPiece(state, line)).toEqual({ kind: "final", name: "Charizard ex" });
  });
  it("is done once the final is in play", () => {
    const state = emptyState({ bench: [{ name: "Charizard ex", enteredTurn: 1 }] });
    expect(nextNeededPiece(state, line)).toEqual({ kind: "done" });
  });
});

describe("pickDiscards", () => {
  const deck = [...copies(charmander(), 4), ...copies(charizard(), 3), ...copies(rareCandy(), 4)];
  const line = lineFor(deck);

  it("never discards a line piece, Rare Candy, ball, or supporter", () => {
    const hand = [charmander(), charizard(), rareCandy(), filler(), filler()];
    const picked = pickDiscards(hand, 2, line);
    expect(picked).not.toBeNull();
    expect(picked!.every((c) => c.name === "Filler Energy")).toBe(true);
  });
  it("returns null when there isn't enough safe fodder", () => {
    const hand = [charmander(), charizard(), rareCandy(), filler()];
    expect(pickDiscards(hand, 2, line)).toBeNull();
  });
});

describe("benchLineBasic", () => {
  it("benches a line Basic and won't bench again once on the path", () => {
    const deck = [...copies(charmander(), 4), ...copies(charizard(), 3), ...copies(rareCandy(), 4)];
    const line = lineFor(deck);
    const state = emptyState({ hand: [charmander(), charmander()] });
    benchLineBasic(state, line, []);
    expect(state.bench).toHaveLength(1);
    benchLineBasic(state, line, []); // already on path → no-op
    expect(state.bench).toHaveLength(1);
  });
});

describe("simulateOneGame — Rare Candy line", () => {
  const deck = [
    ...copies(charmander(), 8),
    ...copies(charizard(), 6),
    ...copies(rareCandy(), 6),
    ...copies(filler(), 40),
  ];
  const line = lineFor(deck);

  it("can set up via Rare Candy and logs it", () => {
    // Search a handful of seeds for a clean candy setup; deterministic given the seed.
    let found = false;
    for (let s = 1; s <= 20 && !found; s++) {
      const out = simulateOneGame(deck, line, makeRng(s), 5, "first");
      if (out.setupTurn !== null && out.log.some((l) => l.includes("Rare Candy"))) {
        expect(out.setupTurn).toBeGreaterThanOrEqual(2); // earliest possible (no T1 evolves)
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe("rule-driven engine (effect text)", () => {
  const poffin = () => mk({ name: "Buddy-Buddy Poffin", category: "Trainer", trainerType: "Item",
    effect: "Search your deck for up to 2 Basic Pokémon with 70 HP or less and put them onto your Bench. Then, shuffle your deck." });
  const research = () => mk({ name: "Professor's Research", category: "Trainer", trainerType: "Supporter",
    effect: "Discard your hand and draw 7 cards." });
  const ultraBall = () => mk({ name: "Ultra Ball", category: "Trainer", trainerType: "Item",
    effect: "You can use this card only if you discard 2 other cards from your hand. Search your deck for a Pokémon, reveal it, and put it into your hand. Then, shuffle your deck." });
  // 70 HP basic so Poffin can grab it.
  const totodile = () => mk({ name: "Totodile", stage: "Basic", hp: 70, chain: ["Totodile"] });
  const feraligatr = () => mk({ name: "Feraligatr", stage: "Stage2", hp: 180, chain: ["Totodile", "Croconaw", "Feraligatr"] });

  it("a consistency engine sets the line up far more often than a vanilla pile", () => {
    const base = [...copies(totodile(), 4), ...copies(feraligatr(), 3), ...copies(rareCandy(), 4)];
    const vanilla = [...base, ...copies(filler(), 49)];
    const engine = [
      ...base,
      ...copies(poffin(), 4), ...copies(ultraBall(), 4), ...copies(research(), 6),
      ...copies(filler(), 35),
    ];
    const vLine = lineFor(vanilla, "Feraligatr");
    const eLine = lineFor(engine, "Feraligatr");
    const v = runSetupSim({ deck: vanilla, line: vLine, iterations: 3000, maxTurns: 5, order: "second", rng: makeRng(4) });
    const e = runSetupSim({ deck: engine, line: eLine, iterations: 3000, maxTurns: 5, order: "second", rng: makeRng(4) });
    const last = (r: typeof v) => r.cumulativeSetup[r.cumulativeSetup.length - 1];
    expect(last(e)).toBeGreaterThan(last(v) + 0.2); // engine is dramatically faster
  });

  it("a Basic's ability (Genesect ex) tutors the evolution and speeds setup", () => {
    const gimmighoul = () => mk({ name: "Gimmighoul", stage: "Basic", hp: 70, energyTypes: ["Metal"], chain: ["Gimmighoul"] });
    const gholdengo = () => mk({ name: "Gholdengo ex", stage: "Stage1", isEx: true, energyTypes: ["Metal"], chain: ["Gimmighoul", "Gholdengo ex"] });
    const genesect = () => mk({ name: "Genesect ex", stage: "Basic", isEx: true, energyTypes: ["Metal"],
      abilities: [{ name: "Metallic Signal", effect: "Once during your turn, you may search your deck for up to 2 Evolution {M} Pokémon, reveal them, and put them into your hand. Then, shuffle your deck." }] });
    const nest = () => mk({ name: "Nest Ball", category: "Trainer", trainerType: "Item",
      effect: "Search your deck for a Basic Pokémon and put it onto your Bench. Then, shuffle your deck." });

    const deck = [...copies(gimmighoul(), 4), ...copies(gholdengo(), 3), ...copies(genesect(), 2), ...copies(nest(), 4), ...copies(filler(), 47)];
    const line = lineFor(deck, "Gholdengo ex");
    let usedAbility = false;
    let anySetup = false;
    for (let s = 1; s <= 25; s++) {
      const out = simulateOneGame(deck, line, makeRng(s), 5, "second");
      if (out.log.some((l) => l.includes("Genesect ex ability → Gholdengo ex"))) usedAbility = true;
      if (out.setupTurn !== null) anySetup = true;
    }
    expect(usedAbility).toBe(true);
    expect(anySetup).toBe(true);
  });

  it("Buddy-Buddy Poffin benches the line basic from the deck (seen in game logs)", () => {
    const deck = [...copies(totodile(), 4), ...copies(feraligatr(), 3), ...copies(rareCandy(), 4), ...copies(poffin(), 8), ...copies(filler(), 42)];
    const line = lineFor(deck, "Feraligatr");
    let benched = false;
    for (let s = 1; s <= 25 && !benched; s++) {
      const out = simulateOneGame(deck, line, makeRng(s), 5, "second");
      if (out.log.some((l) => l.includes("Buddy-Buddy Poffin → benched"))) benched = true;
    }
    expect(benched).toBe(true);
  });
});

describe("runSetupSim — aggregate", () => {
  const deck = [
    ...copies(charmander(), 8),
    ...copies(charmeleon(), 3),
    ...copies(charizard(), 6),
    ...copies(rareCandy(), 6),
    ...copies(filler(), 37),
  ];
  const line = lineFor(deck);

  it("produces monotonic cumulative curves that reconcile with neverSetUpRate", () => {
    const r = runSetupSim({ deck, line, iterations: 2000, maxTurns: 5, order: "first", rng: makeRng(42) });
    expect(r.perTurnSetup).toHaveLength(5);
    expect(r.cumulativeSetup).toHaveLength(5);
    // monotonic non-decreasing
    for (let i = 1; i < r.cumulativeSetup.length; i++) {
      expect(r.cumulativeSetup[i]).toBeGreaterThanOrEqual(r.cumulativeSetup[i - 1]);
    }
    // perTurn sums to 1 - neverSetUpRate
    const sum = r.perTurnSetup.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - (1 - r.neverSetUpRate))).toBeLessThan(1e-9);
    // no T1 setups for a Stage 2 line
    expect(r.perTurnSetup[0]).toBe(0);
    expect(r.unsatisfiable).toBe(false);
  });

  it("going second sets up at least as often by the final turn as going first", () => {
    const first = runSetupSim({ deck, line, iterations: 3000, maxTurns: 5, order: "first", rng: makeRng(7) });
    const second = runSetupSim({ deck, line, iterations: 3000, maxTurns: 5, order: "second", rng: makeRng(7) });
    const last = (r: typeof first) => r.cumulativeSetup[r.cumulativeSetup.length - 1];
    expect(last(second)).toBeGreaterThanOrEqual(last(first) - 0.03);
  });

  it("flags an unsatisfiable line (Stage 2, no Stage 1, no Rare Candy)", () => {
    const broken = [...copies(charmander(), 8), ...copies(charizard(), 6), ...copies(filler(), 46)];
    const bl = lineFor(broken);
    const r = runSetupSim({ deck: broken, line: bl, iterations: 500, maxTurns: 5, rng: makeRng(1) });
    expect(r.unsatisfiable).toBe(true);
    expect(r.neverSetUpRate).toBe(1);
  });

  it("a zero-Basic deck never sets up and the mulligan loop terminates", () => {
    const noBasic = [...copies(charizard(), 10), ...copies(filler(), 50)];
    const bl = lineFor(noBasic);
    const r = runSetupSim({ deck: noBasic, line: bl, iterations: 200, maxTurns: 5, rng: makeRng(3) });
    expect(r.neverSetUpRate).toBe(1);
    expect(r.mulliganRate).toBe(1);
  });
});
