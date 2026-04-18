import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAllCards, getCard, getFilterOptions, getVariants, getVariantGroups } from "../services/card-store.js";
import { ensureCardLoaded, getCardDetail } from "../services/card-detail.js";
import { applyFilters } from "../../shared/utils/filter-cards.js";
import type { CardFilters, SpecialAttribute } from "../../shared/types/filters.js";
import { logAction, getClientIp } from "../services/logger.js";
import { VALID_CARD_ID } from "../../shared/validation.js";

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
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(200, parseInt(query.pageSize ?? "60", 10) || 60));

  const all = getAllCards();
  const filtered = applyFilters(all, filters);
  const start = (page - 1) * pageSize;
  const cards = filtered.slice(start, start + pageSize);

  logAction("card.search", getClientIp(c), { nameSearch: filters.nameSearch, filters, resultCount: filtered.length });
  return c.json({ cards, total: filtered.length, page, pageSize });
});

app.get("/variant-groups", (c) => {
  const groups = getVariantGroups();
  return c.json(groups.map((g) => ({
    name: g.name,
    mechanicsHash: g.mechanicsHash,
    count: g.count,
    energyTypes: g.cards[0].energyTypes,
    cards: g.cards.map((card) => ({
      id: card.id,
      localId: card.localId,
      name: card.name,
      setCode: card.setCode,
      setName: card.setName,
      category: card.category,
      rarity: card.rarity,
      isFullArt: card.isFullArt,
      imageBase: card.imageBase,
      hp: card.hp,
      stage: card.stage,
    })),
  })));
});

app.get("/filters", (c) => {
  return c.json(getFilterOptions());
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  await ensureCardLoaded(id);
  const card = getCard(id);
  if (!card) return c.json({ error: "Card not found" }, 404);
  return c.json(card);
});

app.get("/:id/variants", async (c) => {
  const id = c.req.param("id");
  const byName = c.req.query("byName") === "1";
  await ensureCardLoaded(id);
  const variants = getVariants(id, byName);
  if (variants.length === 0) return c.json({ error: "Card not found" }, 404);
  return c.json({ variants });
});

app.get("/:id/detail", async (c) => {
  const id = c.req.param("id");
  if (!VALID_CARD_ID.test(id)) return c.json({ error: "Invalid card ID" }, 400);
  const detail = await getCardDetail(id);
  if (!detail) return c.json({ error: "Card not found" }, 404);
  logAction("card.view", getClientIp(c), { cardId: id, cardName: detail.name });
  return c.json(detail);
});

app.get("/:id/tcgdex", (c) => {
  const id = c.req.param("id");
  if (!VALID_CARD_ID.test(id)) return c.json({ error: "Invalid card ID" }, 400);
  const jsonPath = join(CACHE_DIR, `${id}.json`);
  if (!existsSync(jsonPath)) return c.json({ error: "No cached TCGdex data" }, 404);
  try {
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    return c.json(raw);
  } catch {
    return c.json({ error: "Failed to parse cached data" }, 500);
  }
});

export default app;
