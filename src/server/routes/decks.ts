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

const app = new Hono();

/** List all saved decks (summaries only) */
app.get("/", async (c) => {
  const decks = await listDecks();
  return c.json(decks);
});

/** Get a single deck by ID */
app.get("/:id", async (c) => {
  const deck = await getDeck(c.req.param("id"));
  if (!deck) return c.json({ error: "Deck not found" }, 404);
  return c.json(deck);
});

/** Create a new deck */
app.post("/", async (c) => {
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

  await createDeck(deck);
  return c.json(deck, 201);
});

/** Update a deck */
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<SavedDeck>>();

  // Don't let the client overwrite the id
  delete body.id;

  const updated = await updateDeck(id, body);
  if (!updated) return c.json({ error: "Deck not found" }, 404);
  return c.json(updated);
});

/** Delete a deck */
app.delete("/:id", async (c) => {
  const ok = await deleteDeck(c.req.param("id"));
  if (!ok) return c.json({ error: "Deck not found" }, 404);
  return c.json({ ok: true });
});

/** Copy a deck */
app.post("/:id/copy", async (c) => {
  const { name } = await c.req.json<{ name?: string }>();
  const original = await getDeck(c.req.param("id"));
  if (!original) return c.json({ error: "Deck not found" }, 404);

  const copyName = name?.trim() || `${original.name} (Copy)`;
  const copy = await copyDeck(c.req.param("id"), copyName);
  if (!copy) return c.json({ error: "Copy failed" }, 500);
  return c.json(copy, 201);
});

/** Diversify card variants in a deck */
app.post("/:id/diversify", async (c) => {
  const deck = await getDeck(c.req.param("id"));
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

  deck.cards = newCards;
  const updated = await updateDeck(deck.id, { cards: newCards });
  return c.json(updated);
});

export default app;
