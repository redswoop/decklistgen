/**
 * Custom sets — locally defined cards that are not on TCGdex (the Feelings
 * Deck, future house cards). Each set is a folder under `custom-sets/`:
 *
 *   custom-sets/<folder>/set.json   — { code, id, name, cards[] }
 *   custom-sets/<folder>/art/<localId>.png — full-bleed 750×1050 artwork
 *
 * A set file's `cards` use the TCGdex card shape (attacks, abilities, hp,
 * types, …) minus `id` / `image` / `set`, which this module fills in. The set
 * `id` must start with `custom-` so `getEra()` files it under the "custom"
 * era, and the `code` is the PTCGL-style code decklists refer to it by.
 *
 * Registration adds the set to SET_MAP / SET_NAMES / REVERSE_SET_MAP, so
 * every consumer that resolves a set code (import, `ensureCardLoaded`, the
 * sets route) treats it like any other set. `card-store.loadSet()` reads the
 * cards from here instead of TCGdex, and `getCardDetail()` reads the raw card
 * from here instead of `cache/<id>.json`.
 *
 * The artwork doubles as the card's "clean" art: the proxy image + status
 * routes fall back to `getCustomArtPath()` when `cache/` has nothing, so a
 * custom card prints through the CSS renderer with no ComfyUI pass.
 *
 * This is the interim path for custom cards described in CARD_IDENTITY.md §5
 * (step 5); the art registry remains the long-term model.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TcgdexCard } from "../../shared/types/card.js";
import {
  CUSTOM_SET_PREFIX,
  REVERSE_SET_MAP,
  SET_MAP,
  SET_NAMES,
} from "../../shared/constants/set-codes.js";

export const DEFAULT_CUSTOM_SETS_DIR = join(import.meta.dir, "../../../custom-sets");

/** URL prefix the client appends `/high.png` or `/low.png` to. */
export const CUSTOM_ART_URL_PREFIX = "/api/custom-sets/art";

export type CustomCardDef = Omit<TcgdexCard, "id" | "image" | "set"> & { localId: string };

export interface CustomSetFile {
  /** PTCGL-style code decklists use, e.g. "FEEL". */
  code: string;
  /** Set id, must start with "custom-", e.g. "custom-feel". */
  id: string;
  name: string;
  cards: CustomCardDef[];
}

export interface CustomSet {
  code: string;
  id: string;
  name: string;
  dir: string;
  cards: TcgdexCard[];
}

const setsByCode = new Map<string, CustomSet>();
const cardsById = new Map<string, { set: CustomSet; raw: TcgdexCard }>();
let registeredDir: string | null = null;

function validateSetFile(file: unknown, path: string): CustomSetFile {
  const f = file as Partial<CustomSetFile>;
  if (!f || typeof f !== "object") throw new Error(`${path}: not an object`);
  if (typeof f.code !== "string" || !/^[A-Z0-9]{2,6}$/.test(f.code)) {
    throw new Error(`${path}: code must be 2–6 uppercase letters/digits`);
  }
  if (typeof f.id !== "string" || !f.id.startsWith(CUSTOM_SET_PREFIX) || !/^[a-z0-9-]+$/.test(f.id)) {
    throw new Error(`${path}: id must start with "${CUSTOM_SET_PREFIX}" and be lowercase [a-z0-9-]`);
  }
  if (typeof f.name !== "string" || !f.name) throw new Error(`${path}: name is required`);
  if (!Array.isArray(f.cards)) throw new Error(`${path}: cards must be an array`);
  for (const c of f.cards) {
    if (typeof c.localId !== "string" || !/^[A-Za-z0-9]+$/.test(c.localId)) {
      throw new Error(`${path}: every card needs an alphanumeric localId`);
    }
    if (typeof c.name !== "string" || !c.name) throw new Error(`${path}: card ${c.localId} has no name`);
  }
  return f as CustomSetFile;
}

function toSet(file: CustomSetFile, dir: string): CustomSet {
  const set: CustomSet = { code: file.code, id: file.id, name: file.name, dir, cards: [] };
  set.cards = file.cards.map((def) => {
    const id = `${file.id}-${def.localId}`;
    return {
      ...def,
      id,
      image: `${CUSTOM_ART_URL_PREFIX}/${id}`,
      set: { id: file.id, name: file.name, cardCount: { official: file.cards.length, total: file.cards.length } },
    };
  });
  return set;
}

/**
 * Discover every set.json one folder below `dir`, register the codes in the shared set maps
 * and index the cards. Idempotent for a given dir; a different dir replaces
 * the registry (tests). Returns the registered codes.
 */
export function registerCustomSets(dir: string = process.env.CUSTOM_SETS_DIR ?? DEFAULT_CUSTOM_SETS_DIR): string[] {
  if (registeredDir === dir) return Array.from(setsByCode.keys());
  for (const set of setsByCode.values()) {
    delete SET_MAP[set.code];
    delete SET_NAMES[set.code];
    delete REVERSE_SET_MAP[set.id];
  }
  setsByCode.clear();
  cardsById.clear();
  registeredDir = dir;

  if (!existsSync(dir)) return [];
  for (const entry of readdirSync(dir).sort()) {
    const folder = join(dir, entry);
    const setPath = join(folder, "set.json");
    if (!statSync(folder).isDirectory() || !existsSync(setPath)) continue;
    let file: CustomSetFile;
    try {
      file = validateSetFile(JSON.parse(readFileSync(setPath, "utf-8")), setPath);
    } catch (e) {
      console.warn(`  Skipping custom set ${entry}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (SET_MAP[file.code] && SET_MAP[file.code] !== file.id) {
      console.warn(`  Skipping custom set ${entry}: code ${file.code} is already a TCGdex set`);
      continue;
    }
    const set = toSet(file, folder);
    setsByCode.set(set.code, set);
    SET_MAP[set.code] = set.id;
    SET_NAMES[set.code] = set.name;
    REVERSE_SET_MAP[set.id] = set.code;
    for (const raw of set.cards) cardsById.set(raw.id, { set, raw });
  }
  return Array.from(setsByCode.keys());
}

/** Lazy default registration; an explicit `registerCustomSets(dir)` sticks. */
function ensureRegistered(): void {
  if (registeredDir === null) registerCustomSets();
}

export function listCustomSets(): CustomSet[] {
  ensureRegistered();
  return Array.from(setsByCode.values());
}

export function isCustomSet(code: string): boolean {
  ensureRegistered();
  return setsByCode.has(code.toUpperCase());
}

export function isCustomCardId(cardId: string): boolean {
  return cardId.startsWith(CUSTOM_SET_PREFIX);
}

/** The set's cards in TCGdex shape, ready for `normalizeCard`. */
export function getCustomSetCards(code: string): TcgdexCard[] {
  ensureRegistered();
  return setsByCode.get(code.toUpperCase())?.cards ?? [];
}

/** The raw card (attacks, abilities, …) — what `cache/<id>.json` is for TCGdex cards. */
export function getCustomCardRaw(cardId: string): TcgdexCard | undefined {
  ensureRegistered();
  return cardsById.get(cardId)?.raw;
}

/** Absolute path of the card's artwork PNG, or undefined when the card is not
 *  custom or has no art file yet. */
export function getCustomArtPath(cardId: string): string | undefined {
  if (!isCustomCardId(cardId)) return undefined;
  ensureRegistered();
  const hit = cardsById.get(cardId);
  if (!hit) return undefined;
  const path = join(hit.set.dir, "art", `${hit.raw.localId}.png`);
  return existsSync(path) ? path : undefined;
}
