import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { getCustomArtPath, listCustomSets } from "../services/custom-sets.js";
import { isValidCardId } from "../../shared/validation.js";

/**
 * Public. Lists the locally defined sets and serves their artwork — the
 * `imageBase` of a custom card points here, and the client appends
 * `/high.png` / `/low.png` (or `/high.webp`) exactly as it does for TCGdex
 * assets, so any trailing file name resolves to the one PNG.
 */
const app = new Hono();

app.get("/", (c) => {
  return c.json(listCustomSets().map((s) => ({
    code: s.code,
    id: s.id,
    name: s.name,
    cardCount: s.cards.length,
  })));
});

app.get("/art/:cardId/:file", async (c) => {
  const cardId = c.req.param("cardId");
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  const path = getCustomArtPath(cardId);
  if (!path) return c.json({ error: "Not found" }, 404);
  const data = await readFile(path);
  return new Response(data, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

export default app;
