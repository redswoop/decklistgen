import { Hono } from "hono";
import type { SavedDeck } from "../../shared/types/deck.js";
import {
  listDecks,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
  copyDeck,
} from "../services/deck-store.js";
import { getVariants } from "../services/card-store.js";
import type { BeautifyOptions } from "../../shared/types/beautify.js";
import { beautifyDeckCards } from "../services/deck-beautify.js";
import { logAction, getClientIp } from "../services/logger.js";
import { findUserById } from "../services/user-store.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import type { Context } from "hono";

const app = new Hono<AppEnv>();

app.use("*", requireAuth);

/**
 * Resolve the user id the request should operate on. Admins may act on another
 * user's decks by sending an `X-Act-As-User` header; everyone else (and admins
 * without the header) operate on their own decks. Returns either the effective
 * user id, or a Response to short-circuit on a permission/validation failure.
 */
function resolveEffectiveUserId(c: Context<AppEnv>): string | Response {
  const user = c.get("user")!;
  const target = c.req.header("X-Act-As-User");
  if (!target || target === user.id) return user.id;
  if (!user.isAdmin) {
    return c.json({ error: "Admin access required to act as another user" }, 403);
  }
  if (!findUserById(target)) {
    return c.json({ error: "Target user not found" }, 404);
  }
  return target;
}

/** List all saved decks (summaries only) */
app.get("/", async (c) => {
  const eff = resolveEffectiveUserId(c);
  if (eff instanceof Response) return eff;
  const decks = await listDecks(eff);
  return c.json(decks);
});

/** Get a single deck by ID */
app.get("/:id", async (c) => {
  const eff = resolveEffectiveUserId(c);
  if (eff instanceof Response) return eff;
  const deck = await getDeck(c.req.param("id"), eff);
  if (!deck) return c.json({ error: "Deck not found" }, 404);
  return c.json(deck);
});

/** Create a new deck */
app.post("/", async (c) => {
  const user = c.get("user")!;
  const eff = resolveEffectiveUserId(c);
  if (eff instanceof Response) return eff;
  const body = await c.req.json<{
    name: string;
    cards: SavedDeck["cards"];
    importedAt?: string;
    importSource?: string;
  }>();

  if (!body.name?.trim()) return c.json({ error: "Name is required" }, 400);

  const now = new Date().toISOString();
  const deck: SavedDeck = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    cards: body.cards ?? [],
    createdAt: now,
    updatedAt: now,
    importedAt: body.importedAt,
    importSource: body.importSource,
  };

  await createDeck(eff, deck);
  logAction("deck.create", getClientIp(c), { deckName: deck.name, cardCount: deck.cards.length, importSource: body.importSource, actingAs: eff !== user.id ? eff : undefined });
  return c.json(deck, 201);
});

/** Update a deck */
app.put("/:id", async (c) => {
  const user = c.get("user")!;
  const eff = resolveEffectiveUserId(c);
  if (eff instanceof Response) return eff;
  const id = c.req.param("id");
  const body = await c.req.json<Partial<SavedDeck>>();

  // Don't let the client overwrite the id
  delete body.id;

  const updated = await updateDeck(id, eff, body);
  if (!updated) return c.json({ error: "Deck not found" }, 404);
  logAction("deck.update", getClientIp(c), { deckId: id, actingAs: eff !== user.id ? eff : undefined });
  return c.json(updated);
});

/** Toggle deck visibility */
app.patch("/:id/visibility", async (c) => {
  const user = c.get("user")!;
  const eff = resolveEffectiveUserId(c);
  if (eff instanceof Response) return eff;
  const id = c.req.param("id");
  const { isPublic, isListed } = await c.req.json<{ isPublic?: boolean; isListed?: boolean }>();

  const updates: Partial<SavedDeck> = {};
  if (isPublic !== undefined) updates.isPublic = isPublic;
  if (isListed !== undefined) updates.isListed = isListed;
  // Can't be listed without being public
  if (updates.isListed && updates.isPublic === undefined) updates.isPublic = true;

  const updated = await updateDeck(id, eff, updates);
  if (!updated) return c.json({ error: "Deck not found" }, 404);
  logAction("deck.visibility", getClientIp(c), { deckId: id, isPublic: updated.isPublic, isListed: updated.isListed, actingAs: eff !== user.id ? eff : undefined });
  return c.json(updated);
});

/** Delete a deck */
app.delete("/:id", async (c) => {
  const user = c.get("user")!;
  const eff = resolveEffectiveUserId(c);
  if (eff instanceof Response) return eff;
  const id = c.req.param("id");
  const ok = await deleteDeck(id, eff);
  if (!ok) return c.json({ error: "Deck not found" }, 404);
  logAction("deck.delete", getClientIp(c), { deckId: id, actingAs: eff !== user.id ? eff : undefined });
  return c.json({ ok: true });
});

/** Copy a deck */
app.post("/:id/copy", async (c) => {
  const user = c.get("user")!;
  const eff = resolveEffectiveUserId(c);
  if (eff instanceof Response) return eff;
  const { name } = await c.req.json<{ name?: string }>();
  const original = await getDeck(c.req.param("id"), eff);
  if (!original) return c.json({ error: "Deck not found" }, 404);

  const copyName = name?.trim() || `${original.name} (Copy)`;
  const copy = await copyDeck(c.req.param("id"), eff, copyName);
  if (!copy) return c.json({ error: "Copy failed" }, 500);
  logAction("deck.copy", getClientIp(c), { deckId: c.req.param("id"), newName: copyName, actingAs: eff !== user.id ? eff : undefined });
  return c.json(copy, 201);
});

/** Beautify card variants in a deck (same algorithm as the Beautify dialog and the MCP tool). */
app.post("/:id/beautify", async (c) => {
  const user = c.get("user")!;
  const eff = resolveEffectiveUserId(c);
  if (eff instanceof Response) return eff;
  const deck = await getDeck(c.req.param("id"), eff);
  if (!deck) return c.json({ error: "Deck not found" }, 404);

  const body = await c.req.json<BeautifyOptions>();
  const { cards } = beautifyDeckCards(deck.cards, (id) => getVariants(id), body);

  const updated = await updateDeck(deck.id, eff, { cards });
  logAction("deck.beautify", getClientIp(c), { deckId: c.req.param("id"), mode: body.mode, actingAs: eff !== user.id ? eff : undefined });
  return c.json({ deck: updated });
});

export default app;
