import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OVERRIDES_PATH = process.env.CARD_TEXT_OVERRIDES_PATH
  ?? join(import.meta.dir, "../../../../data/card-text-overrides.json");

type Patch = Record<string, unknown>;
interface OverridesFile {
  byId?: Record<string, Patch>;
  byName?: Record<string, Record<string, Patch>>;
}

function readOverrides(): OverridesFile {
  if (!existsSync(OVERRIDES_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OVERRIDES_PATH, "utf-8")) as OverridesFile;
  } catch {
    return {};
  }
}

/** Merge any hand-maintained text overrides for `cardId` on top of `data`.
 *  byName entries apply to every card in a set sharing that name (covers
 *  alt-art / secret-rare variants); byId entries win on top for per-card
 *  fixes. Overrides survive a cache wipe and remain authoritative even after
 *  TCGdex backfills the upstream entry. */
export function applyCardTextOverride(
  cardId: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const file = readOverrides();
  const setId = (data.set as { id?: string } | undefined)?.id;
  const name = data.name as string | undefined;
  const nameMatch = setId && name ? file.byName?.[setId]?.[name] : undefined;
  const idMatch = file.byId?.[cardId];
  if (!nameMatch && !idMatch) return data;
  return { ...data, ...nameMatch, ...idMatch };
}
