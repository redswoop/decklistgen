import type { Card, TcgdexCard } from "../../shared/types/card.js";
import type { FilterOptions, SpecialAttribute } from "../../shared/types/filters.js";
import { SET_MAP, REVERSE_SET_MAP, getEra } from "../../shared/constants/set-codes.js";
import { isEx, isV, isVmax, isVstar, isAncient, isFuture, isTera } from "../../shared/utils/detect-attributes.js";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import { fetchSetCards } from "./tcgdex.js";
import { computeMechanicsHash } from "./mechanics-hash.js";
import { readFileSync } from "fs";
import { resolve } from "path";

/** In-memory card index, lazily populated per set */
const cardIndex = new Map<string, Card>();
const loadedSets = new Set<string>();

/** Manual overrides for isPrintUnfriendly (loaded from data/print-overrides.json) */
let printOverrides: Record<string, boolean> = {};
try {
  const overridesPath = resolve(import.meta.dir, "../../../data/print-overrides.json");
  const raw = JSON.parse(readFileSync(overridesPath, "utf-8"));
  // Filter out _comment key
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith("_") && typeof v === "boolean") printOverrides[k] = v;
  }
} catch {
  // No overrides file — that's fine
}

/** Purely manual: only cards explicitly listed in data/print-overrides.json are flagged. */
function computePrintUnfriendly(id: string): boolean {
  return printOverrides[id] === true;
}

function normalizeCard(raw: TcgdexCard, setCode: string): Card {
  const tcgdexId = raw.set?.id ?? SET_MAP[setCode] ?? "";
  const category = (raw.category === "Pokemon" || raw.category === "Trainer" || raw.category === "Energy")
    ? raw.category : "Pokemon";
  const variants = raw.variants ?? {};
  const rarity = raw.rarity ?? "Unknown";

  // Extract parenthetical subtitle, e.g. "Professor's Research (Professor Magnolia)"
  const parenMatch = raw.name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const name = parenMatch ? parenMatch[1] : raw.name;
  const subtitle = parenMatch ? parenMatch[2] : undefined;

  return {
    id: raw.id,
    localId: raw.localId,
    name,
    subtitle,
    imageBase: raw.image ?? "",
    category,
    trainerType: raw.trainerType as Card["trainerType"],
    rarity,
    energyTypes: raw.types ?? [],
    setId: tcgdexId,
    setCode,
    setName: raw.set?.name ?? setCode,
    era: getEra(tcgdexId),
    hp: raw.hp,
    stage: raw.stage,
    retreat: raw.retreat,
    isFullArt: isFullArt(raw),
    isEx: isEx(raw.name),
    isV: isV(raw.name),
    isVmax: isVmax(raw.name),
    isVstar: isVstar(raw.name),
    isAncient: isAncient(raw),
    isFuture: isFuture(raw),
    isTera: isTera(raw),
    hasFoil: !!variants.holo,
    isPrintUnfriendly: computePrintUnfriendly(raw.id),
    mechanicsHash: computeMechanicsHash(raw),
  };
}

export async function loadSet(setCode: string): Promise<number> {
  const code = setCode.toUpperCase();
  if (loadedSets.has(code)) return 0;

  const tcgdexId = SET_MAP[code];
  if (!tcgdexId) throw new Error(`Unknown set code: ${code}`);

  const rawCards = await fetchSetCards(tcgdexId);
  let count = 0;
  for (const raw of rawCards) {
    if (raw.stage === "V-UNION") continue;
    const card = normalizeCard(raw, code);
    if (!cardIndex.has(card.id)) {
      cardIndex.set(card.id, card);
      count++;
    }
  }
  loadedSets.add(code);
  return count;
}

export function getCard(id: string): Card | undefined {
  return cardIndex.get(id);
}

export function getAllCards(): Card[] {
  return Array.from(cardIndex.values());
}

export function getLoadedSets(): string[] {
  return Array.from(loadedSets);
}

/** Get the set name for a loaded set code (from the first card we indexed) */
export function getSetName(code: string): string | undefined {
  for (const card of cardIndex.values()) {
    if (card.setCode === code.toUpperCase()) return card.setName;
  }
  return undefined;
}

export function isSetLoaded(code: string): boolean {
  return loadedSets.has(code.toUpperCase());
}

export async function loadEra(era: "sv" | "swsh"): Promise<{ loaded: number; sets: string[] }> {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const [code, tcgdexId] of Object.entries(SET_MAP)) {
    if (seen.has(tcgdexId)) continue;
    seen.add(tcgdexId);
    if (getEra(tcgdexId) === era) codes.push(code);
  }

  let total = 0;
  const loadedCodes: string[] = [];
  for (const code of codes) {
    try {
      const count = await loadSet(code);
      total += count;
      loadedCodes.push(code);
    } catch (e) {
      console.warn(`  Skipping set ${code}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { loaded: total, sets: loadedCodes };
}

/** Find a card by PTCGL set code and card number (handles zero-padding differences) */
export function findCardBySetAndNumber(setCode: string, number: string): Card | undefined {
  const code = setCode.toUpperCase();
  const tcgdexId = SET_MAP[code];
  if (!tcgdexId) return undefined;

  // Try exact ID match
  const exact = cardIndex.get(`${tcgdexId}-${number}`);
  if (exact) return exact;

  // Try zero-padded
  const padded = number.padStart(3, "0");
  const paddedCard = cardIndex.get(`${tcgdexId}-${padded}`);
  if (paddedCard) return paddedCard;

  // Numeric fallback: search cards in this set
  const num = parseInt(number);
  if (!isNaN(num)) {
    for (const c of cardIndex.values()) {
      if (c.setCode === code && parseInt(c.localId) === num) return c;
    }
  }
  return undefined;
}

/** Find a card by name across all loaded sets.
 *  Matches base name, and also "Name (Subtitle)" format for backward compat. */
export function findCardByName(name: string): Card | undefined {
  const lower = name.toLowerCase();
  // Strip parenthetical from search term too
  const baseLower = lower.replace(/\s*\([^)]+\)\s*$/, "").trim();
  for (const c of cardIndex.values()) {
    if (c.name.toLowerCase() === baseLower) return c;
  }
  return undefined;
}

export function getVariants(cardId: string, byName = false): Card[] {
  const card = cardIndex.get(cardId);
  if (!card) return [];
  const variants: Card[] = [];
  for (const c of cardIndex.values()) {
    if (byName) {
      if (c.name === card.name) variants.push(c);
    } else {
      if (c.name === card.name && c.mechanicsHash === card.mechanicsHash) variants.push(c);
    }
  }
  // Sort by set, then localId
  variants.sort((a, b) => {
    if (a.setId !== b.setId) return a.setId.localeCompare(b.setId);
    const aNum = parseInt(a.localId) || 0;
    const bNum = parseInt(b.localId) || 0;
    return aNum - bNum;
  });
  return variants;
}

/** Get variant groups: cards grouped by name+mechanicsHash, sorted by count desc */
export function getVariantGroups(): Array<{ name: string; mechanicsHash: string; count: number; cards: Card[] }> {
  const groups = new Map<string, Card[]>();
  for (const card of cardIndex.values()) {
    const key = `${card.name}\0${card.mechanicsHash}`;
    const list = groups.get(key);
    if (list) list.push(card);
    else groups.set(key, [card]);
  }
  const result = Array.from(groups.values())
    .filter((cards) => cards.length > 1)
    .map((cards) => ({
      name: cards[0].name,
      mechanicsHash: cards[0].mechanicsHash,
      count: cards.length,
      cards: cards.sort((a, b) => {
        if (a.setId !== b.setId) return a.setId.localeCompare(b.setId);
        return (parseInt(a.localId) || 0) - (parseInt(b.localId) || 0);
      }),
    }))
    .sort((a, b) => b.count - a.count);
  return result;
}

export function getFilterOptions(): FilterOptions {
  const cards = getAllCards();
  const rarities = new Set<string>();
  const energyTypes = new Set<string>();
  const trainerTypes = new Set<string>();
  const sets = new Map<string, string>();

  for (const card of cards) {
    rarities.add(card.rarity);
    card.energyTypes.forEach((t) => energyTypes.add(t));
    if (card.trainerType) trainerTypes.add(card.trainerType);
    if (!sets.has(card.setCode)) sets.set(card.setCode, card.setName);
  }

  const attrChecks: Array<[SpecialAttribute, keyof Card]> = [
    ["ex", "isEx"], ["V", "isV"], ["VMAX", "isVmax"], ["VSTAR", "isVstar"],
    ["Ancient", "isAncient"], ["Future", "isFuture"], ["Tera", "isTera"],
  ];
  const availableAttributes: SpecialAttribute[] = [];
  for (const [attr, field] of attrChecks) {
    if (cards.some((c) => c[field])) availableAttributes.push(attr);
  }

  return {
    rarities: Array.from(rarities).sort(),
    energyTypes: Array.from(energyTypes).sort(),
    trainerTypes: Array.from(trainerTypes).sort(),
    sets: Array.from(sets.entries()).map(([code, name]) => ({ code, name })),
    availableAttributes,
  };
}
