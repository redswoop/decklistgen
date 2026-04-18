import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAllCards,
  getCard,
  getFilterOptions,
  getVariantGroups,
  getVariants,
} from "../../services/card-store.js";
import { ensureCardLoaded, getCardDetail } from "../../services/card-detail.js";
import { applyFilters } from "../../../shared/utils/filter-cards.js";
import type { CardFilters, SpecialAttribute } from "../../../shared/types/filters.js";
import { asJson } from "../util.js";

const specialAttributes = [
  "isEx",
  "isV",
  "isVmax",
  "isVstar",
  "isAncient",
  "isFuture",
  "isTera",
] as const satisfies readonly SpecialAttribute[];

const searchInputSchema = {
  nameSearch: z.string().optional().describe("Substring match on card name (case-insensitive)."),
  sets: z.array(z.string()).optional().describe("Set codes to include, e.g. ['SVI','PAR']."),
  era: z.enum(["sv", "swsh"]).optional().describe("Limit to an era."),
  category: z.enum(["Pokemon", "Trainer", "Energy"]).optional(),
  trainerType: z.enum(["Item", "Supporter", "Stadium", "Tool"]).optional(),
  rarities: z.array(z.string()).optional(),
  energyTypes: z.array(z.string()).optional().describe("e.g. ['Fire','Water']"),
  specialAttributes: z.array(z.enum(specialAttributes)).optional(),
  isFullArt: z.boolean().optional(),
  hasFoil: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(60),
};

export function registerCardTools(server: McpServer): void {
  server.registerTool(
    "search_cards",
    {
      title: "Search cards by name and filters",
      description:
        "Search the loaded-in-memory card index. Returns a paginated list of cards matching " +
        "the given filters. Only cards from sets that have been loaded (see list_sets / load_set " +
        "/ load_era) are searchable.",
      inputSchema: searchInputSchema,
    },
    async (args) => {
      const filters: CardFilters = {};
      if (args.nameSearch) filters.nameSearch = args.nameSearch;
      if (args.sets) filters.sets = args.sets;
      if (args.era) filters.era = args.era;
      if (args.category) filters.category = args.category;
      if (args.trainerType) filters.trainerType = args.trainerType;
      if (args.rarities) filters.rarities = args.rarities;
      if (args.energyTypes) filters.energyTypes = args.energyTypes;
      if (args.specialAttributes) filters.specialAttributes = args.specialAttributes;
      if (args.isFullArt !== undefined) filters.isFullArt = args.isFullArt;
      if (args.hasFoil !== undefined) filters.hasFoil = args.hasFoil;

      const page = args.page;
      const pageSize = args.pageSize;
      const all = getAllCards();
      const filtered = applyFilters(all, filters);
      const start = (page - 1) * pageSize;
      const cards = filtered.slice(start, start + pageSize);

      return asJson({ cards, total: filtered.length, page, pageSize });
    },
  );

  server.registerTool(
    "get_card",
    {
      title: "Get a card's full details",
      description:
        "Return the full CardDetail for a given card ID, including attacks, abilities, " +
        "weaknesses, and description. Auto-loads the set if not already loaded.",
      inputSchema: {
        id: z.string().describe("Card ID, e.g. 'sv06.5-036'."),
      },
    },
    async ({ id }) => {
      const detail = await getCardDetail(id);
      if (!detail) return asJson({ error: `Card not found: ${id}` }, true);
      return asJson(detail);
    },
  );

  server.registerTool(
    "get_card_variants",
    {
      title: "Get alternate prints of a card",
      description:
        "Return all variants (alternate rarities, full arts, reprints) of the given card. " +
        "By default, matches by mechanics hash (same gameplay). Pass byName=true to match by " +
        "card name instead.",
      inputSchema: {
        id: z.string().describe("Card ID, e.g. 'sv06.5-036'."),
        byName: z.boolean().default(false).describe("Match by name instead of mechanics hash."),
      },
    },
    async ({ id, byName }) => {
      await ensureCardLoaded(id);
      const variants = getVariants(id, byName);
      if (variants.length === 0) return asJson({ error: `Card not found: ${id}` }, true);
      return asJson({ variants });
    },
  );

  server.registerTool(
    "get_filter_options",
    {
      title: "Get valid filter values",
      description:
        "Return the universe of valid filter values (rarities, energy types, trainer types, " +
        "etc.) derived from currently-loaded cards. Useful before constructing a search_cards call.",
      inputSchema: {},
    },
    async () => asJson(getFilterOptions()),
  );

  server.registerTool(
    "get_variant_groups",
    {
      title: "List variant groups",
      description:
        "Return all unique card groups keyed by mechanics hash. Each group contains every " +
        "variant of a card that shares gameplay (e.g. a Ho-Oh with multiple alt-art prints).",
      inputSchema: {},
    },
    async () => {
      const groups = getVariantGroups();
      return asJson(
        groups.map((g) => ({
          name: g.name,
          mechanicsHash: g.mechanicsHash,
          count: g.count,
          energyTypes: g.cards[0]?.energyTypes,
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
        })),
      );
    },
  );
}

// Re-exported so tests don't have to import from card-store directly
export { getCard };
