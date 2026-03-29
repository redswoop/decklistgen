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
import type { BeautifyOptions, BeautifyPreview } from "../../shared/types/beautify.js";
import { getRarityRank, sortByRarityDesc, getTopRarityVariants } from "../../shared/utils/rarity-rank.js";
import { deduplicateByArt } from "../../shared/utils/variant-allocation.js";
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function spreadRoundRobin(variants: Card[], totalCount: number): SavedDeck["cards"] {
  if (variants.length === 0) return [];
  const result: SavedDeck["cards"] = [];
  const perVariant = Math.floor(totalCount / variants.length);
  let remainder = totalCount % variants.length;
  for (const variant of variants) {
    const count = perVariant + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    if (count > 0) {
      result.push({ count, card: variant });
    }
  }
  return result;
}

/** Beautify card variants in a deck (replaces diversify) */
app.post("/:id/beautify", async (c) => {
  const user = c.get("user")!;
  const deck = await getDeck(c.req.param("id"), user.id);
  if (!deck) return c.json({ error: "Deck not found" }, 404);

  const body = await c.req.json<BeautifyOptions>();
  const { mode, excludeRarities = [], excludePrintUnfriendly = true } = body;
  const excludeSet = new Set(excludeRarities.map((r) => r.toLowerCase()));

  // Group cards by name
  const byName = new Map<string, { totalCount: number; cardId: string; entries: { cardId: string; count: number }[] }>();
  for (const entry of deck.cards) {
    const existing = byName.get(entry.card.name);
    if (existing) {
      existing.totalCount += entry.count;
      existing.entries.push({ cardId: entry.card.id, count: entry.count });
    } else {
      byName.set(entry.card.name, {
        totalCount: entry.count,
        cardId: entry.card.id,
        entries: [{ cardId: entry.card.id, count: entry.count }],
      });
    }
  }

  // Manual mode: return candidates without modifying
  if (mode === "manual") {
    const candidates: BeautifyPreview[] = [];
    for (const [name, { cardId, entries }] of byName) {
      let variants = getVariants(cardId);
      if (excludePrintUnfriendly) {
        variants = variants.filter((v) => !v.isPrintUnfriendly);
      }
      if (excludeSet.size > 0) {
        variants = variants.filter((v) => !excludeSet.has(v.rarity.toLowerCase()));
      }
      candidates.push({ name, currentCards: entries, variants });
    }
    return c.json({ candidates });
  }

  // Best or random mode: apply changes
  const newCards: SavedDeck["cards"] = [];
  for (const [name, { totalCount, cardId }] of byName) {
    let variants = getVariants(cardId);
    if (excludePrintUnfriendly) {
      variants = variants.filter((v) => !v.isPrintUnfriendly);
    }
    if (excludeSet.size > 0) {
      variants = variants.filter((v) => !excludeSet.has(v.rarity.toLowerCase()));
    }

    // Deduplicate same-art printings — one representative per unique artwork
    variants = deduplicateByArt(variants);

    if (variants.length === 0) {
      // All filtered out — keep original
      const original = deck.cards.find((c) => c.card.name === name)!;
      newCards.push({ count: totalCount, card: original.card });
      continue;
    }

    if (mode === "best") {
      // Concentrate on the highest-rarity variant(s) only
      variants = getTopRarityVariants(variants);
    } else {
      variants = shuffle(variants);
    }

    newCards.push(...spreadRoundRobin(variants, totalCount));
  }

  const updated = await updateDeck(deck.id, user.id, { cards: newCards });
  logAction("deck.beautify", getClientIp(c), { deckId: c.req.param("id"), mode });
  return c.json({ deck: updated });
});

export default app;
