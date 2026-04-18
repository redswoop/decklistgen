import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateSvgFromTemplate } from "../../services/pokeproxy/render-svg.js";
import { getCard } from "../../services/card-store.js";
import { ensureCardLoaded } from "../../services/card-detail.js";
import { cardImageUrl } from "../../../shared/utils/card-image-url.js";
import { ping as comfyPing, COMFYUI_URL } from "../../services/comfyui.js";
import { isValidCardId } from "../../../shared/validation.js";
import { asJson, asText } from "../util.js";

export function registerProxyTools(server: McpServer): void {
  server.registerTool(
    "render_proxy_svg",
    {
      title: "Render a card as a proxy SVG",
      description:
        "Render a Pokemon card as an SVG proxy using DecklistGen's template engine. " +
        "Returns the SVG text. If the card's source image isn't cached, it is fetched from " +
        "TCGdex on demand.",
      inputSchema: {
        cardId: z.string(),
        fullart: z
          .boolean()
          .default(false)
          .describe("Force fullart template even if the card has its standard illustration."),
        synth: z
          .boolean()
          .default(false)
          .describe("Use synthetic attack text that exercises every energy-glyph color."),
      },
    },
    async ({ cardId, fullart, synth }) => {
      if (!isValidCardId(cardId)) return asJson({ error: "Invalid card ID" }, true);
      try {
        const svg = await generateSvgFromTemplate(cardId, { fullart, synth });
        return asText(svg);
      } catch (e) {
        return asJson({ error: e instanceof Error ? e.message : String(e) }, true);
      }
    },
  );

  server.registerTool(
    "get_card_image_url",
    {
      title: "Get a card's TCGdex image URL",
      description:
        "Return the canonical TCGdex image URL for a card at the requested resolution. " +
        "These are CDN-hosted PNGs suitable for embedding.",
      inputSchema: {
        cardId: z.string(),
        quality: z.enum(["high", "low"]).default("high"),
      },
    },
    async ({ cardId, quality }) => {
      if (!isValidCardId(cardId)) return asJson({ error: "Invalid card ID" }, true);
      await ensureCardLoaded(cardId);
      const card = getCard(cardId);
      if (!card) return asJson({ error: `Card not found: ${cardId}` }, true);
      return asJson({ url: cardImageUrl(card.imageBase, quality), cardId, quality });
    },
  );

  server.registerTool(
    "proxy_status",
    {
      title: "Check ComfyUI availability",
      description:
        "Ping the configured ComfyUI backend (used for artwork beautification). Returns " +
        "whether it responded and the configured URL.",
      inputSchema: {},
    },
    async () => {
      const ok = await comfyPing();
      return asJson({ ok, url: COMFYUI_URL });
    },
  );
}
