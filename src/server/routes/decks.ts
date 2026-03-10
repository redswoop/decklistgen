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
import type { Card } from "../../shared/types/card.js";
import { logAction, getClientIp } from "../services/logger.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();

app.use("*", requireAuth);

/** List all saved decks (summaries only) */
app.get("/", async (c) => {
  const user = c.get("user")!
  const decks = await listDecks(user.id);
  return c.json(decks);
});

/** Get a single deck by ID */
app.get("/:id", async (c) => {
  const user = c.get("user")!
  const deck = await getDeck(c.req.param("id"), user.id);
  if (!deck) return c.json({ error: "Deck not found" }, 404);
  return c.json(deck);
});

/** Create a new deck */
app.post("/", async (c) => {
  const user = c.get("user")!
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

  await createDeck(user.id, deck);
  logAction("deck.create", getClientIp(c), { deckName: deck.name, cardCount: deck.cards.length, importSource: body.importSource });
  return c.json(deck, 201);
});

/** Update a deck */
app.put("/:id", async (c) => {
  const user = c.get("user")!
  const id = c.req.param("id");
  const body = await c.req.json<Partial<SavedDeck>>();

  // Don't let the client overwrite the id
  delete body.id;

  const updated = await updateDeck(id, user.id, body);
  if (!updated) return c.json({ error: "Deck not found" }, 404);
  logAction("deck.update", getClientIp(c), { deckId: id });
  return c.json(updated);
});

/** Toggle deck visibility */
app.patch("/:id/visibility", async (c) => {
  const user = c.get("user")!
  const id = c.req.param("id");
  const { isPublic, isListed } = await c.req.json<{ isPublic?: boolean; isListed?: boolean }>();

  const updates: Partial<SavedDeck> = {};
  if (isPublic !== undefined) updates.isPublic = isPublic;
  if (isListed !== undefined) updates.isListed = isListed;
  // Can't be listed without being public
  if (updates.isListed && updates.isPublic === undefined) updates.isPublic = true;

  const updated = await updateDeck(id, user.id, updates);
  if (!updated) return c.json({ error: "Deck not found" }, 404);
  logAction("deck.visibility", getClientIp(c), { deckId: id, isPublic: updated.isPublic, isListed: updated.isListed });
  return c.json(updated);
});

/** Delete a deck */
app.delete("/:id", async (c) => {
  const user = c.get("user")!
  const id = c.req.param("id");
  const ok = await deleteDeck(id, user.id);
  if (!ok) return c.json({ error: "Deck not found" }, 404);
  logAction("deck.delete", getClientIp(c), { deckId: id });
  return c.json({ ok: true });
});

/** Copy a deck */
app.post("/:id/copy", async (c) => {
  const user = c.get("user")!
  const { name } = await c.req.json<{ name?: string }>();
  const original = await getDeck(c.req.param("id"), user.id);
  if (!original) return c.json({ error: "Deck not found" }, 404);

  const copyName = name?.trim() || `${original.name} (Copy)`;
  const copy = await copyDeck(c.req.param("id"), user.id, copyName);
  if (!copy) return c.json({ error: "Copy failed" }, 500);
  logAction("deck.copy", getClientIp(c), { deckId: c.req.param("id"), newName: copyName });
  return c.json(copy, 201);
});

/** Diversify card variants in a deck */
app.post("/:id/diversify", async (c) => {
  const user = c.get("user")!
  const deck = await getDeck(c.req.param("id"), user.id);
  if (!deck) return c.json({ error: "Deck not found" }, 404);

  // Group cards by name
  const byName = new Map<string, { totalCount: number; cardId: string }>();
  for (const entry of deck.cards) {
    const existing = byName.get(entry.card.name);
    if (existing) {
      existing.totalCount += entry.count;
    } else {
      byName.set(entry.card.name, { totalCount: entry.count, cardId: entry.card.id });
    }
  }

  // For each name, get variants and spread counts
  const newCards: SavedDeck["cards"] = [];
  for (const [name, { totalCount, cardId }] of byName) {
    const variants = getVariants(cardId);
    if (variants.length <= 1) {
      // No variants available, keep original
      const original = deck.cards.find((c) => c.card.name === name)!;
      newCards.push({ count: totalCount, card: original.card });
      continue;
    }

    // Spread count across variants round-robin
    const perVariant = Math.floor(totalCount / variants.length);
    let remainder = totalCount % variants.length;
    for (const variant of variants) {
      const count = perVariant + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      if (count > 0) {
        newCards.push({ count, card: variant });
      }
    }
  }

  const updated = await updateDeck(deck.id, user.id, { cards: newCards });
  logAction("deck.diversify", getClientIp(c), { deckId: c.req.param("id") });
  return c.json(updated);
});

export default app;
