import type { Card, TcgdexCard } from "../../shared/types/card.js";
import type { FilterOptions } from "../../shared/types/filters.js";
import { SET_MAP, REVERSE_SET_MAP, getEra } from "../../shared/constants/set-codes.js";
import { isEx, isV, isVmax, isVstar, isAncient, isFuture, isTera } from "../../shared/utils/detect-attributes.js";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import { fetchSetCards } from "./tcgdex.js";

/** In-memory card index, lazily populated per set */
const cardIndex = new Map<string, Card>();
const loadedSets = new Set<string>();

function normalizeCard(raw: TcgdexCard, setCode: string): Card {
  const tcgdexId = raw.set?.id ?? SET_MAP[setCode] ?? "";
  const category = (raw.category === "Pokemon" || raw.category === "Trainer" || raw.category === "Energy")
    ? raw.category : "Pokemon";
  const variants = raw.variants ?? {};

  return {
    id: raw.id,
    localId: raw.localId,
    name: raw.name,
    imageUrl: raw.image ? `${raw.image}/high.png` : "",
    category,
    trainerType: raw.trainerType as Card["trainerType"],
    rarity: raw.rarity ?? "Unknown",
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
    hasFoil: !!(variants.holo || variants.reverse),
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
    } catch (e: any) {
      console.warn(`  Skipping set ${code}: ${e.message}`);
    }
  }
  return { loaded: total, sets: loadedCodes };
}

/** Find all variants of a card (same name across loaded cards) */
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

/** Find a card by name across all loaded sets */
export function findCardByName(name: string): Card | undefined {
  const lower = name.toLowerCase();
  for (const c of cardIndex.values()) {
    if (c.name.toLowerCase() === lower) return c;
  }
  return undefined;
}

export function getVariants(cardId: string): Card[] {
  const card = cardIndex.get(cardId);
  if (!card) return [];
  const variants: Card[] = [];
  for (const c of cardIndex.values()) {
    if (c.name === card.name) variants.push(c);
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

  return {
    rarities: Array.from(rarities).sort(),
    energyTypes: Array.from(energyTypes).sort(),
    trainerTypes: Array.from(trainerTypes).sort(),
    sets: Array.from(sets.entries()).map(([code, name]) => ({ code, name })),
  };
}
