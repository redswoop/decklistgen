import type { Card } from "../types/card.js";
import {
  isRareCandy,
  isBattleVipPass,
  ballSpec,
  botSupporter,
} from "./setup-cards.js";

/**
 * Infer what a Trainer card *does for setup* from its printed effect text, so
 * the simulator's bot understands the whole card pool rather than a hand-curated
 * list. We only classify setup-relevant capabilities (drawing, searching for
 * Pokémon/Trainers/Supporters, benching Basics, Rare Candy); everything else —
 * healing, switching, damage, energy acceleration, Tools, Stadiums — returns
 * null and the bot treats the card as inert.
 *
 * Cards without effect text (e.g. older cached entries, or synthetic test cards)
 * fall back to name-based detection in setup-cards.ts.
 */

export type PokeRestrict = "any" | "basic" | "evolution" | "non-rule-box";

export type Capability =
  | { type: "draw"; amount: number; shuffleHand: boolean }
  | { type: "draw-to"; size: number }
  /** Search Basics → Bench directly (Buddy-Buddy Poffin, Nest Ball). */
  | { type: "bench-basics"; count: number; maxHp?: number; energyType?: string }
  /** Search a Pokémon → hand (Ultra Ball, Poké Pad, Hilda, …). */
  | { type: "search-pokemon"; restrict: PokeRestrict; count: number; maxHp?: number; energyType?: string }
  /** Search the whole evolution line → hand (Dawn). */
  | { type: "search-line" }
  | { type: "search-trainer" }
  | { type: "search-supporter" }
  | { type: "rare-candy" };

export interface SetupRule {
  cap: Capability;
  source: "item" | "supporter";
  /** Cards discarded from hand as a play cost. */
  discard: number;
  /** Effect only happens on a coin flip (~50%). */
  coinFlip: boolean;
}

function sourceOf(card: Card): "item" | "supporter" | null {
  if (card.category !== "Trainer") return null;
  if (card.trainerType === "Item") return "item";
  if (card.trainerType === "Supporter") return "supporter";
  return null; // Stadium / Tool — not modeled
}

function parseDiscardCost(text: string): number {
  // "discard 2 other cards", "discard another card", "discard a Basic ... card"
  const m = text.match(/only if you discard (\d+|a|an|another)\b/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 1 : n;
}

function parseMaxHp(text: string): number | undefined {
  const m = text.match(/(\d+)\s*hp or less/);
  return m ? parseInt(m[1], 10) : undefined;
}

function parseCount(text: string): number {
  const m = text.match(/up to (\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function pokeRestriction(text: string): PokeRestrict {
  if (/doesn't have a rule box|does not have a rule box/.test(text)) return "non-rule-box";
  // Allow an energy symbol between the keyword and "Pokémon" (e.g. "Basic {F} Pokémon").
  if (/evolution (\{[a-z]\} )?pok[eé]mon/.test(text)) return "evolution";
  if (/basic (\{[a-z]\} )?pok[eé]mon/.test(text)) return "basic";
  return "any";
}

const ENERGY_SYMBOL: Record<string, string> = {
  f: "Fighting", d: "Darkness", l: "Lightning", w: "Water", r: "Fire",
  p: "Psychic", m: "Metal", g: "Grass", c: "Colorless", n: "Dragon",
};

/** Energy-type restriction on a Pokémon search, e.g. "Basic {F} Pokémon" → "Fighting". */
function pokeEnergyType(obj: string): string | undefined {
  const m = obj.match(/\{([fdlwrpmgcn])\}[^.]*?pok[eé]mon/);
  return m ? ENERGY_SYMBOL[m[1]] : undefined;
}

/** The core inference: map effect text to a setup capability, or null. */
export function capabilityFromEffect(text: string): { cap: Capability; coinFlip: boolean } | null {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  const coinFlip = /flip a coin\. if heads/.test(t);

  // Rare Candy.
  if (/evolve it, skipping the stage 1|skipping the stage 1/.test(t)) {
    return { cap: { type: "rare-candy" }, coinFlip: false };
  }

  const toBench = /onto (your|their) bench/.test(t);
  const toHand = /into your hand/.test(t);

  // What does the card actually search for? Isolate the object of "search your
  // deck for …" up to the next verb, so e.g. Crispin (searches *Energy*, then
  // "attach … to your Pokémon") isn't misread as a Pokémon tutor.
  const sm = t.match(/search your deck for (.+?)(?:,? reveal|,? and put|,? and attach|\.|$)/);
  const obj = sm?.[1] ?? "";
  // "Pokémon Tool" is a Trainer subtype, not a Pokémon — don't let it read as one
  // (e.g. Arven searches an Item card + a Pokémon Tool card).
  const objNoTool = obj.replace(/pok[eé]mon tool/g, "tool");
  const objIsPokemon = /pok[eé]mon/.test(objNoTool);
  const objIsEnergyOnly = /energy/.test(objNoTool) && !objIsPokemon;

  // Search the whole line into hand (Dawn).
  if (toHand && /basic pok[eé]mon, a stage 1 pok[eé]mon, and a stage 2 pok[eé]mon/.test(objNoTool)) {
    return { cap: { type: "search-line" }, coinFlip };
  }

  // Search Basics → Bench (Poffin, Nest Ball).
  if (toBench && /basic pok[eé]mon/.test(objNoTool)) {
    return { cap: { type: "bench-basics", count: parseCount(obj), maxHp: parseMaxHp(obj), energyType: pokeEnergyType(objNoTool) }, coinFlip };
  }

  // Search a Supporter / Trainer/Item → hand (Petrel, Arven, …).
  if (toHand && (/supporter card/.test(obj) || (/look at the top \d+ cards/.test(t) && /supporter card/.test(t)))) {
    return { cap: { type: "search-supporter" }, coinFlip };
  }
  if (toHand && /trainer card|item card/.test(obj)) {
    return { cap: { type: "search-trainer" }, coinFlip };
  }

  // Search a Pokémon → hand (Ultra Ball, Poké Pad, Hilda, Quick/Level Ball, …).
  if (toHand && objIsPokemon && !objIsEnergyOnly) {
    return {
      cap: {
        type: "search-pokemon",
        restrict: pokeRestriction(objNoTool),
        count: parseCount(obj),
        maxHp: parseMaxHp(obj),
        energyType: pokeEnergyType(objNoTool),
      },
      coinFlip,
    };
  }

  // Draw effects.
  const until = t.match(/draw cards until you have (\d+) cards? in your hand/);
  if (until) return { cap: { type: "draw-to", size: parseInt(until[1], 10) }, coinFlip: false };

  if (/draw/.test(t)) {
    const shuffleHand = /shuffle your hand into your deck|hand (into your deck|on the bottom)/.test(t);
    const nums = [...t.matchAll(/draws? (\d+) cards?/g)].map((m) => parseInt(m[1], 10));
    if (nums.length > 0) {
      // Use the largest stated draw (covers "draw 6 … draw 8 instead" — we always hold 6 prizes).
      return { cap: { type: "draw", amount: Math.max(...nums), shuffleHand }, coinFlip: false };
    }
  }

  return null;
}

/**
 * Classify a card into a setup rule. Effect text first (general), then a
 * name-based fallback for cards lacking effect text.
 */
export function classifyCard(card: Card & { effect?: string }): SetupRule | null {
  const source = sourceOf(card);

  if (source && card.effect) {
    const parsed = capabilityFromEffect(card.effect);
    if (parsed) {
      return { cap: parsed.cap, source, discard: parseDiscardCost(card.effect.toLowerCase()), coinFlip: parsed.coinFlip };
    }
    return null;
  }

  // --- Name-based fallback (no effect text available) ---
  return nameFallbackRule(card);
}

function nameFallbackRule(card: Card): SetupRule | null {
  if (isRareCandy(card)) return { cap: { type: "rare-candy" }, source: "item", discard: 0, coinFlip: false };
  const ball = ballSpec(card);
  if (ball) {
    if (ball.kind === "nest") return { cap: { type: "bench-basics", count: 1 }, source: "item", discard: 0, coinFlip: false };
    const restrict: PokeRestrict = ball.fetch === "any-pokemon" ? "any" : "basic";
    const maxHp = ball.fetch === "pokemon-hp-le-90" ? 90 : undefined;
    return { cap: { type: "search-pokemon", restrict, count: 1, maxHp }, source: "item", discard: ball.discard, coinFlip: false };
  }
  if (isBattleVipPass(card)) return { cap: { type: "bench-basics", count: 2, maxHp: undefined }, source: "item", discard: 0, coinFlip: false };
  const sup = botSupporter(card);
  if (sup === "professors-research") return { cap: { type: "draw", amount: 7, shuffleHand: true }, source: "supporter", discard: 0, coinFlip: false };
  if (sup === "iono") return { cap: { type: "draw", amount: 6, shuffleHand: true }, source: "supporter", discard: 0, coinFlip: false };
  if (sup === "arven") return { cap: { type: "search-trainer" }, source: "supporter", discard: 0, coinFlip: false };

  return null;
}

// --- Pokémon abilities -------------------------------------------------------

/**
 * A Pokémon's setup-relevant ability (draw / search), on any stage. Basic-stage
 * bearers are benched directly; evolution-stage bearers (Bibarel, Dudunsparce,
 * Delphox) are reached by setting up that engine line. Situational abilities
 * (triggered by a Knock Out / opponent action) and passive/static ones are
 * skipped — they don't act during the setup turns.
 */
export interface AbilityRule {
  cap: Capability;
  /** "on-bench" fires when the Pokémon is benched; "active-turn" is once per turn while in play. */
  trigger: "active-turn" | "on-bench";
  /** Must discard an Energy from hand to use. */
  requiresEnergy: boolean;
  /** A Pokémon (by lowercased name) that must be in play to use this (e.g. Lunatone needs Solrock). */
  requiresInPlay?: string;
}

export function classifyAbility(card: Card & { abilities?: Array<{ name: string; effect: string }> }): AbilityRule | null {
  if (card.category !== "Pokemon") return null;

  for (const ab of card.abilities ?? []) {
    const t = ab.effect.toLowerCase().replace(/\s+/g, " ");
    if (/knocked out|opponent's last turn|during your opponent/.test(t)) continue; // situational
    const onBench = /when you play this pok[eé]mon from your hand (onto your bench|to evolve)/.test(t);
    const active = onBench || /once during your turn|once during each of your turns|as often as you like during your turn/.test(t);
    if (!active) continue; // passive / static ability — not an action

    const parsed = capabilityFromEffect(ab.effect);
    if (!parsed) continue;
    const ct = parsed.cap.type;
    if (!(ct === "draw" || ct === "draw-to" || ct === "search-pokemon" || ct === "search-line" || ct === "search-supporter" || ct === "bench-basics")) {
      continue;
    }
    const requiresEnergy = /discard a[n]? [^.]*?energy/.test(t);
    const inPlay = t.match(/if you have ([a-z0-9'.\- ]+?) in play/);
    return {
      cap: parsed.cap,
      trigger: onBench ? "on-bench" : "active-turn",
      requiresEnergy,
      requiresInPlay: inPlay ? inPlay[1].trim() : undefined,
    };
  }
  return null;
}
