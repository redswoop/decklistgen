import { EFFECT_TAG_OVERRIDES } from "../constants/effect-tag-overrides.js";

/**
 * Function tags: what a card *does*, inferred from its printed effect text so
 * the whole pool (and future sets) is tagged without a hand-curated list. Tags
 * are flat and multi-valued — Iono is draw + hand-refresh + disrupt:hand — and
 * derived at load time, never stored, so renaming or splitting one is a code
 * change with no migration.
 *
 * The registry below is the vocabulary: the catalog's filter chips, the grid's
 * "Function" grouping and the MCP `search_cards` tool all read it.
 *
 * Coverage today: Supporters and Items. Tools, Stadiums, abilities and attacks
 * are untagged (not mis-tagged) until their rules are written and audited.
 * Misreads are fixed by improving a rule; `EFFECT_TAG_OVERRIDES` is the escape
 * hatch for the cards a rule can't reasonably catch.
 */

export interface EffectFacetDef {
  id: string;
  label: string;
}

export const EFFECT_FACETS = [
  { id: "draw", label: "Draw" },
  { id: "search", label: "Search" },
  { id: "board", label: "Gust & Switch" },
  { id: "energy", label: "Energy" },
  { id: "recovery", label: "Recovery" },
  { id: "healing", label: "Healing" },
  { id: "disruption", label: "Disruption" },
  { id: "damage", label: "Damage" },
  { id: "evolution", label: "Evolution" },
] as const satisfies readonly EffectFacetDef[];

export type EffectFacet = (typeof EFFECT_FACETS)[number]["id"];

export interface EffectTagDef {
  id: string;
  label: string;
  facet: EffectFacet;
  description: string;
}

export const EFFECT_TAGS = [
  { id: "draw", label: "Draw", facet: "draw", description: "You draw cards." },
  { id: "hand-refresh", label: "Hand refresh", facet: "draw", description: "You trade your hand for a new one (shuffle or discard it, then draw)." },
  { id: "dig", label: "Dig", facet: "draw", description: "Look at the top (or bottom) cards of your deck — take some, or rearrange them. Not a full search: it can miss." },
  { id: "search:pokemon", label: "Search Pokémon", facet: "search", description: "Find Pokémon in your deck (to hand or Bench). A full search, or a look at the top cards if also tagged Dig." },
  { id: "search:energy", label: "Search Energy", facet: "search", description: "Find Energy in your deck. A full search, or a look at the top cards if also tagged Dig." },
  { id: "search:supporter", label: "Search Supporter", facet: "search", description: "Find Supporter cards in your deck. A full search, or a look at the top cards if also tagged Dig." },
  { id: "search:item", label: "Search Item", facet: "search", description: "Find Item cards in your deck. A full search, or a look at the top cards if also tagged Dig." },
  { id: "search:tool", label: "Search Tool", facet: "search", description: "Find Pokémon Tool cards in your deck. A full search, or a look at the top cards if also tagged Dig." },
  { id: "search:stadium", label: "Search Stadium", facet: "search", description: "Find Stadium cards in your deck. A full search, or a look at the top cards if also tagged Dig." },
  { id: "search:any", label: "Search any", facet: "search", description: "Search your deck for any card you like." },
  { id: "gust", label: "Gust", facet: "board", description: "You pick one of your opponent's Benched Pokémon and drag it Active." },
  { id: "forced-switch", label: "Forced switch", facet: "board", description: "Your opponent's Active Pokémon is switched out, but they pick the replacement." },
  { id: "switch", label: "Switch", facet: "board", description: "Switch your own Active Pokémon out." },
  { id: "scoop", label: "Scoop", facet: "board", description: "Pick up one of your Pokémon in play, back to hand or deck." },
  { id: "energy-accel", label: "Energy accel", facet: "energy", description: "Attach Energy beyond your one manual attachment per turn." },
  { id: "energy-move", label: "Energy move", facet: "energy", description: "Move Energy between your Pokémon." },
  { id: "recover", label: "Recover", facet: "recovery", description: "Get cards back from your discard pile." },
  { id: "heal", label: "Heal", facet: "healing", description: "Heal damage from your Pokémon." },
  { id: "disrupt:hand", label: "Hand disruption", facet: "disruption", description: "Shrink, shuffle or discard from your opponent's hand." },
  { id: "disrupt:energy", label: "Energy removal", facet: "disruption", description: "Remove Energy from your opponent's Pokémon." },
  { id: "disrupt:tool-stadium", label: "Tool/Stadium removal", facet: "disruption", description: "Discard Pokémon Tools or the Stadium in play." },
  { id: "lock", label: "Lock", facet: "disruption", description: "Stop your opponent from playing cards, using Abilities, attacking or retreating." },
  { id: "damage-boost", label: "Damage boost", facet: "damage", description: "Your attacks do more damage." },
  { id: "damage-reduce", label: "Damage reduce", facet: "damage", description: "Your Pokémon take less damage, or none." },
  { id: "damage-place", label: "Damage counters", facet: "damage", description: "Put or move damage counters directly." },
  { id: "evolve", label: "Evolve", facet: "evolution", description: "Evolve (or devolve) outside the normal once-per-turn evolution." },
] as const satisfies readonly EffectTagDef[];

export type EffectTag = (typeof EFFECT_TAGS)[number]["id"];

const TAG_ORDER = new Map<string, number>(EFFECT_TAGS.map((t, i) => [t.id, i]));
const TAG_BY_ID = new Map<string, EffectTagDef>(EFFECT_TAGS.map((t) => [t.id, t]));
const FACET_LABEL = new Map<string, string>(EFFECT_FACETS.map((f) => [f.id, f.label]));

export function isEffectTag(value: string): value is EffectTag {
  return TAG_BY_ID.has(value);
}

/** Registry entry for a tag id, or undefined for an id that isn't (or is no longer) a tag. */
export function effectTagDef(id: string): EffectTagDef | undefined {
  return TAG_BY_ID.get(id);
}

/** Group label for cards with no function tag. */
export const UNTAGGED_FACET_LABEL = "Other";

/** Facet labels in registry order — the grid's "Function" group order. */
export const EFFECT_FACET_LABELS: readonly string[] = EFFECT_FACETS.map((f) => f.label);

/**
 * The facet labels a card's tags fall under, in registry order and deduped. A
 * card with tags in two facets belongs to both groups (Iono is Draw *and*
 * Disruption); an untagged card yields [].
 */
export function facetLabelsOf(tags: readonly string[] | undefined): string[] {
  const labels = new Set<string>();
  for (const f of EFFECT_FACETS) {
    if (tags?.some((t) => TAG_BY_ID.get(t)?.facet === f.id)) labels.add(FACET_LABEL.get(f.id)!);
  }
  return [...labels];
}

/**
 * Does a card's tag list satisfy one requested tag? A bare prefix matches its
 * whole family, so "search" matches search:pokemon and "disrupt" matches
 * disrupt:hand.
 */
export function hasEffectTag(tags: readonly string[] | undefined, wanted: string): boolean {
  if (!tags?.length) return false;
  const prefix = `${wanted}:`;
  return tags.some((t) => t === wanted || t.startsWith(prefix));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/é/g, "e").replace(/\s+/g, " ").trim();
}

/** The kinds of card a "search for …" / "… you find there" phrase names. */
function fetchedKinds(phrase: string): EffectTag[] {
  // "Pokémon Tool" is a Trainer subtype, not a Pokémon (Arven).
  let obj = phrase.replace(/pokemon tools?/g, "tool");
  const tags: EffectTag[] = [];
  // Qualifiers name Energy types / Pokémon without making them the object:
  // "Basic {D} Energy to attach to your {D} Pokémon" is still an Energy search.
  const isEnergy = /energy/.test(obj);
  // "a Trainer card" (Petrel) can be any of the four Trainer kinds.
  const anyTrainer = /\btrainer\b/.test(obj);
  const trainerKinds: Array<[EffectTag, RegExp]> = [
    ["search:supporter", /\bsupporter\b/],
    ["search:item", /\bitem\b/],
    ["search:tool", /\btools?\b/],
    ["search:stadium", /\bstadium\b/],
  ];
  obj = obj.replace(/\bto (1 of )?your [^,]*pokemon/g, "");
  const isPokemon = /pokemon|card that evolves from/.test(obj.replace(/\{[a-z]\} energy|energy cards?/g, ""));
  if (isPokemon) tags.push("search:pokemon");
  if (isEnergy) tags.push("search:energy");
  for (const [tag, re] of trainerKinds) if (anyTrainer || re.test(obj)) tags.push(tag);
  return tags;
}

/** What "search your deck for …" is fetching, isolated up to the next verb. */
function searchTags(t: string): EffectTag[] {
  const tags = new Set<EffectTag>();
  const re = /search your deck for (.+?)(?:,? reveal|,? and put|,? and attach|,? and discard|,? and shuffle|,? put |\.|$)/g;
  for (const m of t.matchAll(re)) {
    const kinds = fetchedKinds(m[1]);
    for (const k of kinds) tags.add(k);
    if (!kinds.length && /\bcards?\b/.test(m[1])) tags.add("search:any");
  }
  return [...tags];
}

const DIG = /(look at|reveal) the (top|bottom) (\d+ )?cards? of your deck|each player reveals the top \d+ cards of their deck/;

/**
 * A dig that names what it takes — "reveal a Supporter card you find there"
 * (Pokégear), "a Pokémon you find there" (Great Ball) — is a limited search for
 * that kind, so it carries the search tag next to `dig`. A dig that takes any
 * cards (Colress's Experiment) stays `dig` alone: it is not a pick-what-you-want
 * search:any.
 */
function digTags(t: string): EffectTag[] {
  if (!DIG.test(t)) return [];
  const tags = new Set<EffectTag>(["dig"]);
  for (const m of t.matchAll(/\b(?:reveal|puts?|attach) ([^.]*?) (?:you|they) find there/g)) {
    for (const k of fetchedKinds(m[1])) tags.add(k);
  }
  return [...tags];
}

type Rule = [tag: EffectTag, test: RegExp];

const RULES: Rule[] = [
  // "draw 3 cards", "draw cards until…", "draws a card for each…" — but not when
  // only the opponent draws ("they draw 3 cards").
  ["draw", /(?<!your opponent )(?<!opponent may )(?<!they )\bdraws? (\d+|a|an|cards|that many|up to \d+)\b/],
  // Your own hand — an opponent-only shuffle (Special Red Card) is disrupt:hand.
  ["hand-refresh", /shuffle your hand (into your deck|and put it on the bottom)|each player shuffles their hand|discard your hand and draw|cards in your hand, shuffle those cards into your deck/],
  // You choose the target. When the opponent picks the replacement (Repel, Ryme)
  // it is a forced-switch instead.
  ["gust", /switch in 1 of your opponent's benched [^.]*pokemon|switch 1 of your opponent's benched [^.]*with (their|his or her|your opponent's) active|onto your opponent's bench\b.*switch in that pokemon to the active spot/],
  ["forced-switch", /switch out your opponent's active pokemon|opponent switch(es)? (their|his or her) active pokemon with 1 of (their|his or her) benched|opponent chooses 1 of (their|his or her) benched pokemon and switches it with (their|his or her) active|each player switches their active/],
  ["switch", /switch your active [^.]*with 1 of your benched|each player switches their active|switch that pokemon with your active/],
  ["scoop", /put (1 of your|your active) [^.]*pokemon[^.]* into your hand|shuffle 1 of your [^.]*pokemon[^.]* into your deck/],
  ["energy-accel", /\battach [^.]*energy|energy[^.]* and attach (it|them) to|energy card, attach it to|attach (the other|the rest) to/],
  ["energy-move", /move (an?|\d+|up to \d+|any (amount|number) of|all) [^.]*energy[^.]* from (?!(1 of )?your opponent's)[^.]*pokemon[^.]* to/],
  ["recover", /from your discard pile,? [^.]*(into|in) your hand|from your discard pile[^.]*(into|on top of|on the bottom of|onto) your (deck|bench)/],
  ["heal", /heal (\d+|all) damage/],
  // Revealing the hand is only disruption when a card leaves it.
  ["disrupt:hand", /opponent shuffles their hand|each player shuffles their hand|(opponent|each player) discards? [^.]*from their hand|opponent counts the cards in their hand, shuffles|opponent reveals their hand.*(discard [^.]*(you find there|from it)|you find there[^.]* (on the bottom|on top) of their deck)/],
  ["disrupt:energy", /(discard|put|shuffle|move) [^.]*energy( cards?)? (attached to|from) [^.]*your opponent's|energy attached to (1 of )?your opponent's [^.]*(discard|on top of|into their)/],
  ["disrupt:tool-stadium", /discard [^.]*pokemon tools?( cards?)? [^.]*(from|attached to) [^.]*pokemon|pokemon tools? attached to [^.]*(discard|lost zone)|discard (a|any|the|that) stadium/],
  ["lock", /opponent can't play any|opponent's [^.]*(has|have) no abilities|(their|your opponent's) [^.]*pokemon[^.]* can't (attack|retreat)/],
  ["damage-boost", /\d+ more damage/],
  ["damage-reduce", /\d+ less damage|prevent all (damage|effects)/],
  ["damage-place", /put \d+ damage counters? on|move (\d+|up to \d+|all|any (amount|number) of) damage counters?/],
  ["evolve", /\bevolves? (it|that pokemon|1 of your)|to evolve it|devolve/],
];

/** Tag one block of effect text. Pure; returns tags in registry order. */
export function tagEffectText(text: string): EffectTag[] {
  const t = normalize(text);
  if (!t) return [];
  const tags = new Set<EffectTag>([...searchTags(t), ...digTags(t)]);
  for (const [tag, re] of RULES) if (re.test(t)) tags.add(tag);
  return sortTags([...tags]);
}

function sortTags(tags: EffectTag[]): EffectTag[] {
  return tags.sort((a, b) => TAG_ORDER.get(a)! - TAG_ORDER.get(b)!);
}

/** The slice of a raw card the tagger reads. */
export interface TaggableCard {
  name: string;
  category?: string;
  trainerType?: string;
  effect?: string;
}

/** Override key: the card name without its "(Professor Magnolia)" parenthetical. */
function overrideKey(name: string): string {
  return name.replace(/\s*\([^)]+\)\s*$/, "");
}

/**
 * Function tags for a card. Supporters and Items only for now — everything
 * else returns [] rather than a half-right answer.
 */
export function tagCard(card: TaggableCard): EffectTag[] {
  if (card.category !== "Trainer") return [];
  if (card.trainerType !== "Supporter" && card.trainerType !== "Item") return [];

  const tags = new Set<EffectTag>(card.effect ? tagEffectText(card.effect) : []);
  const override = EFFECT_TAG_OVERRIDES[overrideKey(card.name)];
  for (const t of override?.remove ?? []) tags.delete(t);
  for (const t of override?.add ?? []) tags.add(t);
  return sortTags([...tags]);
}
