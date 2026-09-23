import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCard, ensureCardLoaded } from "./card-store.js";
import { inferEvolveFrom } from "./evolution-chain.js";
import type { CardDetail } from "../../shared/types/card.js";

// Re-exported for existing callers (routes, MCP tools); the implementation
// lives in card-store so evolution-chain can import it without a cycle.
export { ensureCardLoaded };

const CACHE_DIR = process.env.TCGDEX_CACHE_DIR ?? join(import.meta.dir, "../../../cache");

/**
 * A Stage 1/2 Pokémon must print "Evolves from …". When its own TCGdex JSON
 * lacks the field (new sets are published half-populated and backfilled later,
 * and our cache is write-once), we need to infer it from elsewhere.
 */
export function needsEvolveFromFallback(stage: string | undefined, evolveFrom: string | undefined): boolean {
  if (evolveFrom) return false;
  const s = (stage ?? "").toLowerCase();
  return s === "stage1" || s === "stage2";
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

  let evolveFrom = (raw.evolveFrom as string) ?? undefined;
  if (needsEvolveFromFallback(card.stage, evolveFrom)) {
    evolveFrom = await inferEvolveFrom(card.name);
  }

  const weaknesses = (raw.weaknesses as Array<{ type: string; value: string }>) ?? [];
  const resistances = (raw.resistances as Array<{ type: string; value: string }>) ?? [];

  return {
    ...card,
    attacks,
    abilities,
    weaknesses,
    resistances,
    description: (raw.description as string) ?? undefined,
    evolveFrom,
    effect: (raw.effect as string) ?? undefined,
  };
}
