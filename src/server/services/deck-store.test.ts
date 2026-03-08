import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { mkdir, rm, readdir } from "fs/promises";
import { join } from "path";
import {
  listDecks,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
  copyDeck,
} from "./deck-store.js";
import type { SavedDeck } from "../../shared/types/deck.js";
import type { Card } from "../../shared/types/card.js";

const TEST_DIR = join(process.cwd(), "data", "decks");

function makeCard(overrides?: Partial<Card>): Card {
  return {
    id: "sv06.5-036",
    localId: "036",
    name: "Okidogi ex",
    imageBase: "https://example.com/img",
    category: "Pokemon",
    rarity: "Double Rare",
    energyTypes: ["Darkness"],
    setId: "sv06.5",
    setCode: "SFA",
    setName: "Shrouded Fable",
    era: "sv",
    isFullArt: false,
    isEx: true,
    isV: false,
    isVmax: false,
    isVstar: false,
    isAncient: false,
    isFuture: false,
    isTera: false,
    hasFoil: false,
    ...overrides,
  };
}

function makeDeck(overrides?: Partial<SavedDeck>): SavedDeck {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Test Deck",
    cards: [{ count: 4, card: makeCard() }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Clean up before each test
beforeEach(async () => {
  try {
    const files = await readdir(TEST_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const { unlink } = await import("fs/promises");
        await unlink(join(TEST_DIR, file));
      }
    }
  } catch {
    // Directory might not exist yet
  }
});

afterAll(async () => {
  // Clean up test decks
  try {
    const files = await readdir(TEST_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const { unlink } = await import("fs/promises");
        await unlink(join(TEST_DIR, file));
      }
    }
  } catch {}
});

describe("deck-store", () => {
  test("createDeck and getDeck round-trip", async () => {
    const deck = makeDeck({ name: "Round Trip Deck" });
    await createDeck(deck);

    const fetched = await getDeck(deck.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Round Trip Deck");
    expect(fetched!.cards).toHaveLength(1);
    expect(fetched!.cards[0].count).toBe(4);
    expect(fetched!.cards[0].card.name).toBe("Okidogi ex");
  });

  test("listDecks returns summaries sorted by updatedAt desc", async () => {
    const deck1 = makeDeck({
      name: "Older Deck",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    const deck2 = makeDeck({
      name: "Newer Deck",
      updatedAt: "2024-06-01T00:00:00.000Z",
    });
    await createDeck(deck1);
    await createDeck(deck2);

    const list = await listDecks();
    expect(list.length).toBeGreaterThanOrEqual(2);

    const names = list.map((d) => d.name);
    const idx1 = names.indexOf("Newer Deck");
    const idx2 = names.indexOf("Older Deck");
    expect(idx1).toBeLessThan(idx2);
  });

  test("listDecks summary has correct cardCount", async () => {
    const deck = makeDeck({
      name: "Count Deck",
      cards: [
        { count: 4, card: makeCard() },
        { count: 2, card: makeCard({ id: "sv06.5-037", localId: "037", name: "Munkidori" }) },
      ],
    });
    await createDeck(deck);

    const list = await listDecks();
    const found = list.find((d) => d.name === "Count Deck");
    expect(found).toBeDefined();
    expect(found!.cardCount).toBe(6);
    expect(found!.uniqueCards).toBe(2);
  });

  test("updateDeck modifies name and sets updatedAt", async () => {
    const deck = makeDeck({
      name: "Original Name",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    await createDeck(deck);

    const updated = await updateDeck(deck.id, { name: "New Name" });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("New Name");
    expect(updated!.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  test("updateDeck returns null for nonexistent deck", async () => {
    const result = await updateDeck("nonexistent-id", { name: "Nope" });
    expect(result).toBeNull();
  });

  test("deleteDeck removes the deck", async () => {
    const deck = makeDeck({ name: "Delete Me" });
    await createDeck(deck);

    const ok = await deleteDeck(deck.id);
    expect(ok).toBe(true);

    const fetched = await getDeck(deck.id);
    expect(fetched).toBeNull();
  });

  test("deleteDeck returns false for nonexistent deck", async () => {
    const ok = await deleteDeck("nonexistent-id");
    expect(ok).toBe(false);
  });

  test("copyDeck creates a new deck with different id", async () => {
    const deck = makeDeck({ name: "Original" });
    await createDeck(deck);

    const copy = await copyDeck(deck.id, "Copy of Original");
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(deck.id);
    expect(copy!.name).toBe("Copy of Original");
    expect(copy!.cards).toHaveLength(deck.cards.length);
    expect(copy!.cards[0].card.name).toBe(deck.cards[0].card.name);
  });

  test("copyDeck returns null for nonexistent deck", async () => {
    const result = await copyDeck("nonexistent-id", "Nope");
    expect(result).toBeNull();
  });

  test("getDeck returns null for nonexistent deck", async () => {
    const result = await getDeck("does-not-exist");
    expect(result).toBeNull();
  });
});
