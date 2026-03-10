import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  listDecks,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
  copyDeck,
  listPublicDecks,
} from "./deck-store.js";
import { getDb } from "./db/database.js";
import type { SavedDeck } from "../../shared/types/deck.js";
import type { Card } from "../../shared/types/card.js";

const TEST_USER_ID = "test-user-" + crypto.randomUUID();
const OTHER_USER_ID = "other-user-" + crypto.randomUUID();

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

// Create test users
beforeEach(() => {
  // Clean up test decks
  getDb().query("DELETE FROM decks WHERE user_id IN (?, ?)").run(TEST_USER_ID, OTHER_USER_ID);
  // Ensure test users exist
  getDb().query("INSERT OR IGNORE INTO users (id, email, password_hash, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)").run(TEST_USER_ID, `${TEST_USER_ID}@test.com`, "hash", "Test User", new Date().toISOString(), new Date().toISOString());
  getDb().query("INSERT OR IGNORE INTO users (id, email, password_hash, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)").run(OTHER_USER_ID, `${OTHER_USER_ID}@test.com`, "hash", "Other User", new Date().toISOString(), new Date().toISOString());
});

afterAll(() => {
  getDb().query("DELETE FROM decks WHERE user_id IN (?, ?)").run(TEST_USER_ID, OTHER_USER_ID);
  getDb().query("DELETE FROM users WHERE id IN (?, ?)").run(TEST_USER_ID, OTHER_USER_ID);
});

describe("deck-store", () => {
  test("createDeck and getDeck round-trip", async () => {
    const deck = makeDeck({ name: "Round Trip Deck" });
    await createDeck(TEST_USER_ID, deck);

    const fetched = await getDeck(deck.id, TEST_USER_ID);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Round Trip Deck");
    expect(fetched!.cards).toHaveLength(1);
    expect(fetched!.cards[0].count).toBe(4);
    expect(fetched!.cards[0].card.name).toBe("Okidogi ex");
  });

  test("listDecks returns only user's decks sorted by updatedAt desc", async () => {
    const deck1 = makeDeck({ name: "Older Deck", updatedAt: "2024-01-01T00:00:00.000Z" });
    const deck2 = makeDeck({ name: "Newer Deck", updatedAt: "2024-06-01T00:00:00.000Z" });
    const otherDeck = makeDeck({ name: "Other User Deck" });
    await createDeck(TEST_USER_ID, deck1);
    await createDeck(TEST_USER_ID, deck2);
    await createDeck(OTHER_USER_ID, otherDeck);

    const list = await listDecks(TEST_USER_ID);
    const names = list.map((d) => d.name);
    expect(names).toContain("Newer Deck");
    expect(names).toContain("Older Deck");
    expect(names).not.toContain("Other User Deck");

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
    await createDeck(TEST_USER_ID, deck);

    const list = await listDecks(TEST_USER_ID);
    const found = list.find((d) => d.name === "Count Deck");
    expect(found).toBeDefined();
    expect(found!.cardCount).toBe(6);
    expect(found!.uniqueCards).toBe(2);
  });

  test("updateDeck modifies name and sets updatedAt", async () => {
    const deck = makeDeck({ name: "Original Name", updatedAt: "2020-01-01T00:00:00.000Z" });
    await createDeck(TEST_USER_ID, deck);

    const updated = await updateDeck(deck.id, TEST_USER_ID, { name: "New Name" });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("New Name");
    expect(updated!.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  test("updateDeck returns null for other user's deck", async () => {
    const deck = makeDeck({ name: "Owned Deck" });
    await createDeck(TEST_USER_ID, deck);

    const result = await updateDeck(deck.id, OTHER_USER_ID, { name: "Hijack" });
    expect(result).toBeNull();
  });

  test("deleteDeck removes the deck", async () => {
    const deck = makeDeck({ name: "Delete Me" });
    await createDeck(TEST_USER_ID, deck);

    const ok = await deleteDeck(deck.id, TEST_USER_ID);
    expect(ok).toBe(true);

    const fetched = await getDeck(deck.id, TEST_USER_ID);
    expect(fetched).toBeNull();
  });

  test("deleteDeck returns false for other user's deck", async () => {
    const deck = makeDeck({ name: "Not Yours" });
    await createDeck(TEST_USER_ID, deck);

    const ok = await deleteDeck(deck.id, OTHER_USER_ID);
    expect(ok).toBe(false);
  });

  test("copyDeck creates a new deck with different id", async () => {
    const deck = makeDeck({ name: "Original" });
    await createDeck(TEST_USER_ID, deck);

    const copy = await copyDeck(deck.id, TEST_USER_ID, "Copy of Original");
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(deck.id);
    expect(copy!.name).toBe("Copy of Original");
    expect(copy!.cards).toHaveLength(deck.cards.length);
  });

  test("copyDeck can copy a public deck from another user", async () => {
    const deck = makeDeck({ name: "Public Deck", isPublic: true });
    await createDeck(TEST_USER_ID, deck);

    const copy = await copyDeck(deck.id, OTHER_USER_ID, "My Copy");
    expect(copy).not.toBeNull();
    expect(copy!.name).toBe("My Copy");
  });

  test("copyDeck returns null for private deck from another user", async () => {
    const deck = makeDeck({ name: "Private Deck" });
    await createDeck(TEST_USER_ID, deck);

    const copy = await copyDeck(deck.id, OTHER_USER_ID, "Steal");
    expect(copy).toBeNull();
  });

  test("getDeck returns null for nonexistent deck", async () => {
    const result = await getDeck("does-not-exist", TEST_USER_ID);
    expect(result).toBeNull();
  });

  test("getDeck allows access to public deck from other user", async () => {
    const deck = makeDeck({ name: "Shared Deck", isPublic: true });
    await createDeck(TEST_USER_ID, deck);

    const fetched = await getDeck(deck.id, OTHER_USER_ID);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Shared Deck");
  });

  test("getDeck denies access to private deck from other user", async () => {
    const deck = makeDeck({ name: "Private" });
    await createDeck(TEST_USER_ID, deck);

    const fetched = await getDeck(deck.id, OTHER_USER_ID);
    expect(fetched).toBeNull();
  });

  test("listPublicDecks returns only listed decks", async () => {
    const publicListed = makeDeck({ name: "Listed", isPublic: true, isListed: true });
    const publicUnlisted = makeDeck({ name: "Unlisted", isPublic: true });
    const privateDeck = makeDeck({ name: "Private" });
    await createDeck(TEST_USER_ID, publicListed);
    await createDeck(TEST_USER_ID, publicUnlisted);
    await createDeck(TEST_USER_ID, privateDeck);

    const result = await listPublicDecks();
    const names = result.decks.map((d) => d.name);
    expect(names).toContain("Listed");
    expect(names).not.toContain("Unlisted");
    expect(names).not.toContain("Private");
  });

  test("visibility update works", async () => {
    const deck = makeDeck({ name: "Vis Test" });
    await createDeck(TEST_USER_ID, deck);

    const updated = await updateDeck(deck.id, TEST_USER_ID, { isPublic: true, isListed: true });
    expect(updated!.isPublic).toBe(true);
    expect(updated!.isListed).toBe(true);

    const fetched = await getDeck(deck.id, TEST_USER_ID);
    expect(fetched!.isPublic).toBe(true);
    expect(fetched!.isListed).toBe(true);
  });
});
