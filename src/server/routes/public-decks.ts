import { Hono } from "hono";
import { listPublicDecks, getDeck, copyDeck } from "../services/deck-store.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();

/** List public decks (is_listed = 1) */
app.get("/", async (c) => {
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const pageSize = parseInt(c.req.query("pageSize") ?? "20", 10);
  const decks = await listPublicDecks(page, pageSize);
  return c.json(decks);
});

/** Get a single public deck */
app.get("/:id", async (c) => {
  const deck = await getDeck(c.req.param("id"));
  if (!deck || !deck.isPublic) return c.json({ error: "Deck not found" }, 404);
  return c.json(deck);
});

/** Copy a public deck to the authenticated user's account */
app.post("/:id/copy", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Authentication required" }, 401);

  const deck = await getDeck(c.req.param("id"));
  if (!deck || !deck.isPublic) return c.json({ error: "Deck not found" }, 404);

  const copy = await copyDeck(c.req.param("id"), user.id, `${deck.name} (Copy)`);
  if (!copy) return c.json({ error: "Copy failed" }, 500);
  return c.json(copy, 201);
});

export { app as publicDecksRouter };
