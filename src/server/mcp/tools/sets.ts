import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SET_MAP, SET_NAMES, getEra } from "../../../shared/constants/set-codes.js";
import { loadSet, loadEra, isSetLoaded, getSetName } from "../../services/card-store.js";
import type { SetInfo } from "../../../shared/types/card.js";
import { asJson } from "../util.js";

export function registerSetTools(server: McpServer): void {
  server.registerTool(
    "list_sets",
    {
      title: "List all Pokemon TCG sets",
      description:
        "List every Pokemon TCG set known to DecklistGen, with code, TCGdex ID, name, era, " +
        "and whether it has been loaded into memory yet. Sets must be loaded before their " +
        "cards can be searched — use load_set or load_era to load them.",
      inputSchema: {},
    },
    async () => {
      const sets: SetInfo[] = [];
      const seen = new Set<string>();
      for (const [code, tcgdexId] of Object.entries(SET_MAP)) {
        if (seen.has(tcgdexId)) continue;
        seen.add(tcgdexId);
        sets.push({
          code,
          tcgdexId,
          name: SET_NAMES[code] ?? getSetName(code) ?? code,
          era: getEra(tcgdexId),
          loaded: isSetLoaded(code),
        });
      }
      return asJson({ sets, total: sets.length });
    },
  );

  server.registerTool(
    "load_set",
    {
      title: "Load a set's cards from TCGdex",
      description:
        "Fetch all cards for a single set from TCGdex and add them to the in-memory index. " +
        "Returns the number of cards loaded. Use the set code from list_sets (e.g. 'SVI', 'PAR').",
      inputSchema: {
        code: z.string().min(1).describe("Set code, e.g. 'SVI'. Case-insensitive."),
      },
    },
    async ({ code }) => {
      const normalized = code.toUpperCase();
      if (!SET_MAP[normalized]) {
        return asJson({ error: `Unknown set: ${normalized}` }, true);
      }
      const loaded = await loadSet(normalized);
      return asJson({ loaded, code: normalized, name: getSetName(normalized) });
    },
  );

  server.registerTool(
    "load_era",
    {
      title: "Load every set in an era",
      description:
        "Load all sets in a given era ('sv' for Scarlet & Violet, 'swsh' for Sword & Shield). " +
        "Convenient for bulk-loading; may take a few seconds on first call.",
      inputSchema: {
        era: z.enum(["sv", "swsh"]).describe("Era to load."),
      },
    },
    async ({ era }) => {
      const result = await loadEra(era);
      return asJson(result);
    },
  );
}
