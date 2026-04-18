import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCard, loadSet, isSetLoaded } from "./card-store.js";
import { REVERSE_SET_MAP } from "../../shared/constants/set-codes.js";
import type { CardDetail } from "../../shared/types/card.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

export async function ensureCardLoaded(cardId: string): Promise<void> {
  if (getCard(cardId)) return;
  const setId = cardId.replace(/-[^-]+$/, "");
  const setCode = REVERSE_SET_MAP[setId];
  if (setCode && !isSetLoaded(setCode)) {
    await loadSet(setCode);
  }
}

/** Enrich a Card with attacks/abilities/weaknesses/resistances from cached TCGdex JSON. */
export async function getCardDetail(cardId: string): Promise<CardDetail | null> {
  await ensureCardLoaded(cardId);
  const card = getCard(cardId);
  if (!card) return null;

  let raw: Record<string, unknown> = {};
  const jsonPath = join(CACHE_DIR, `${cardId}.json`);
  if (existsSync(jsonPath)) {
    try {
      raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    } catch {}
  }

  const attacks = ((raw.attacks as Array<Record<string, unknown>>) ?? []).map((atk) => ({
    name: (atk.name as string) ?? "",
    cost: (atk.cost as string[]) ?? [],
    damage: atk.damage != null ? String(atk.damage) : undefined,
    effect: (atk.effect as string) ?? undefined,
  }));

  const abilities = ((raw.abilities as Array<Record<string, unknown>>) ?? []).map((ab) => ({
    name: (ab.name as string) ?? "",
    type: (ab.type as string) ?? "Ability",
    effect: (ab.effect as string) ?? "",
  }));

  const weaknesses = (raw.weaknesses as Array<{ type: string; value: string }>) ?? [];
  const resistances = (raw.resistances as Array<{ type: string; value: string }>) ?? [];

  return {
    ...card,
    attacks,
    abilities,
    weaknesses,
    resistances,
    description: (raw.description as string) ?? undefined,
    evolveFrom: (raw.evolveFrom as string) ?? undefined,
  };
}
