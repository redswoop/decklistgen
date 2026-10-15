import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCard } from "../../services/card-store.js";
import { ensureCardLoaded, readArtImage, ART_TYPES, MAX_THUMB_WIDTH } from "../../services/pokeproxy/cache.js";
import { getArtStatus } from "../../services/card-generation.js";
import { cardImageUrl } from "../../../shared/utils/card-image-url.js";
import { ping as comfyPing, COMFYUI_URL } from "../../services/comfyui.js";
import { isValidCardId } from "../../../shared/validation.js";
import sharp from "sharp";
import { asJson } from "../util.js";
import { absoluteUrl, fail, type McpContext } from "../context.js";

/**
 * Image tools. `get_card_image_url` hands back links (TCGdex CDN for the scan,
 * this server for custom-set art and the pipeline's renders); `get_card_image`
 * returns the bytes themselves as an MCP image block, which is the only way a
 * remote Claude can *see* a render that exists solely in this server's cache —
 * custom-set art above all.
 */

const artType = z.enum(ART_TYPES).describe(
  "'source' = the original scan (custom-set art for custom cards; fetched from TCGdex on a cache miss), " +
  "'clean' = text-stripped illustration, 'composite' = clean art re-composited with text, 'fullart' = expanded illustration.",
);

const DEFAULT_IMAGE_WIDTH = 512;

export function registerProxyTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "get_card_image_url",
    {
      title: "Get a card's image URLs",
      description:
        "Return fetchable URLs for a card: the original scan (`url`, TCGdex CDN — or this server for custom-set " +
        "cards) plus, under `images`, this server's `/api/pokeproxy/image/...` links for every render that exists " +
        "in its cache (source / clean / composite / fullart; append `?w=<px>` for a thumbnail). " +
        "Use get_card_image when you need to actually look at the picture.",
      inputSchema: {
        cardId: z.string(),
        quality: z.enum(["high", "low"]).default("high"),
      },
    },
    async ({ cardId, quality }) => {
      if (!isValidCardId(cardId)) return fail("Invalid card ID");
      await ensureCardLoaded(cardId);
      const card = getCard(cardId);
      if (!card) return fail(`Card not found: ${cardId}`);
      const status = getArtStatus(cardId);
      const available: Record<string, boolean> = {
        source: true,
        clean: status.hasClean,
        composite: status.hasComposite,
        fullart: status.hasFullart,
      };
      const images: Record<string, string> = {};
      for (const type of ART_TYPES) {
        if (available[type]) images[type] = absoluteUrl(ctx, `/api/pokeproxy/image/${cardId}/${type}`);
      }
      return asJson({
        cardId,
        quality,
        url: absoluteUrl(ctx, cardImageUrl(card.imageBase, quality)),
        isCustom: card.imageBase.startsWith("/"),
        images,
      });
    },
  );

  server.registerTool(
    "get_card_image",
    {
      title: "Fetch a card image",
      description:
        "Return a card's image inline so you can look at it — the original scan, or one of this server's " +
        "cached renders (custom-set artwork is served as both 'source' and 'clean'). Resized to `width` pixels " +
        `(default ${DEFAULT_IMAGE_WIDTH}, max ${MAX_THUMB_WIDTH}; 0 = full size), JPEG by default (PNG is 5-10× larger). ` +
        "Errors when that render does not exist; check get_card_image_url or deck_art_status first.",
      inputSchema: {
        cardId: z.string(),
        type: artType.default("source"),
        width: z.number().int().min(0).max(MAX_THUMB_WIDTH).default(DEFAULT_IMAGE_WIDTH),
        format: z.enum(["jpeg", "png"]).default("jpeg"),
      },
    },
    async ({ cardId, type, width, format }) => {
      if (!isValidCardId(cardId)) return fail("Invalid card ID");
      await ensureCardLoaded(cardId);
      const card = getCard(cardId);
      if (!card) return fail(`Card not found: ${cardId}`);
      let data: Buffer | undefined;
      try {
        data = await readArtImage(cardId, type, width);
        if (data && format === "jpeg") data = await sharp(data).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
      } catch (e) {
        return fail(`Could not read ${type} image for ${cardId}: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!data) return fail(`No ${type} image for ${cardId} (${card.name}).`);
      return {
        content: [
          { type: "image", data: data.toString("base64"), mimeType: `image/${format}` },
          {
            type: "text",
            text: JSON.stringify({
              cardId,
              name: card.name,
              type,
              format,
              width: width || "full",
              bytes: data.byteLength,
              url: absoluteUrl(ctx, `/api/pokeproxy/image/${cardId}/${type}${width ? `?w=${width}` : ""}`),
            }),
          },
        ],
      };
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
