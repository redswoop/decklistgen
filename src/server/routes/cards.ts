import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAllCards, getCard, getFilterOptions, getVariants } from "../services/card-store.js";
import { applyFilters } from "../../shared/utils/filter-cards.js";
import type { CardFilters, SpecialAttribute } from "../../shared/types/filters.js";
import type { CardDetail } from "../../shared/types/card.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

const app = new Hono();

function parseFilters(query: Record<string, string>): CardFilters {
  const filters: CardFilters = {};
  if (query.sets) filters.sets = query.sets.split(",");
  if (query.era) filters.era = query.era as "sv" | "swsh";
  if (query.category) filters.category = query.category as CardFilters["category"];
  if (query.trainerType) filters.trainerType = query.trainerType;
  if (query.rarities) filters.rarities = query.rarities.split(",");
  if (query.energyTypes) filters.energyTypes = query.energyTypes.split(",");
  if (query.specialAttributes) filters.specialAttributes = query.specialAttributes.split(",") as SpecialAttribute[];
  if (query.isFullArt !== undefined) filters.isFullArt = query.isFullArt === "true";
  if (query.hasFoil !== undefined) filters.hasFoil = query.hasFoil === "true";
  if (query.nameSearch) filters.nameSearch = query.nameSearch;
  return filters;
}

app.get("/", (c) => {
  const query = c.req.query();
  const filters = parseFilters(query);
  const page = parseInt(query.page ?? "1", 10);
  const pageSize = parseInt(query.pageSize ?? "60", 10);

  const all = getAllCards();
  const filtered = applyFilters(all, filters);
  const start = (page - 1) * pageSize;
  const cards = filtered.slice(start, start + pageSize);

  return c.json({ cards, total: filtered.length, page, pageSize });
});

app.get("/filters", (c) => {
  return c.json(getFilterOptions());
});

app.get("/:id", (c) => {
  const id = c.req.param("id");
  const card = getCard(id);
  if (!card) return c.json({ error: "Card not found" }, 404);
  return c.json(card);
});

app.get("/:id/variants", (c) => {
  const id = c.req.param("id");
  const variants = getVariants(id);
  if (variants.length === 0) return c.json({ error: "Card not found" }, 404);
  return c.json({ variants });
});

app.get("/:id/detail", (c) => {
  const id = c.req.param("id");
  const card = getCard(id);
  if (!card) return c.json({ error: "Card not found" }, 404);

  // Load full TCGdex data from cache JSON
  let raw: Record<string, unknown> = {};
  const jsonPath = join(CACHE_DIR, `${id}.json`);
  if (existsSync(jsonPath)) {
    try {
      raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    } catch {}
  }

  const attacks = ((raw.attacks as Array<Record<string, unknown>>) ?? []).map(atk => ({
    name: (atk.name as string) ?? "",
    cost: (atk.cost as string[]) ?? [],
    damage: atk.damage != null ? String(atk.damage) : undefined,
    effect: (atk.effect as string) ?? undefined,
  }));

  const abilities = ((raw.abilities as Array<Record<string, unknown>>) ?? []).map(ab => ({
    name: (ab.name as string) ?? "",
    type: (ab.type as string) ?? "Ability",
    effect: (ab.effect as string) ?? "",
  }));

  const weaknesses = (raw.weaknesses as Array<{ type: string; value: string }>) ?? [];
  const resistances = (raw.resistances as Array<{ type: string; value: string }>) ?? [];

  const detail: CardDetail = {
    ...card,
    attacks,
    abilities,
    weaknesses,
    resistances,
    description: (raw.description as string) ?? undefined,
    evolveFrom: (raw.evolveFrom as string) ?? undefined,
  };

  return c.json(detail);
});

export default app;
