import { Hono } from "hono";
import { getAllCards, getCard, getFilterOptions, getVariants } from "../services/card-store.js";
import { applyFilters } from "../../shared/utils/filter-cards.js";
import type { CardFilters, SpecialAttribute } from "../../shared/types/filters.js";

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

export default app;
