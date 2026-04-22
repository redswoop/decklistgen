import { describe, it, expect, beforeEach } from "bun:test";

// Mock localStorage before importing useDecklist
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  length: 0,
  key: () => null,
};

// Must import after localStorage mock is in place
// Dynamic import to ensure the module-level code sees our mock
const { useDecklist } = await import("./useDecklist.js");
import type { DecklistItem } from "./useDecklist.js";
import type { Card } from "../../shared/types/card.js";

function makeCard(id: string, name = `Card ${id}`): Card {
  return {
    id,
    name,
    localId: id,
    setCode: "test",
    imageBase: `https://example.com/${id}`,
    category: "Pokemon",
  } as Card;
}

function makeItem(id: string, count = 1, name = `Card ${id}`): DecklistItem {
  const card = makeCard(id, name);
  return {
    setCode: card.setCode,
    localId: card.localId,
    count,
    name: card.name,
    imageUrl: `https://example.com/${id}/low.png`,
    card,
  };
}

describe("useDecklist undo/redo", () => {
  let deck: ReturnType<typeof useDecklist>;

  let resetCounter = 0;

  beforeEach(() => {
    localStorage.clear();
    deck = useDecklist();
    // Clear any leftover state from previous tests
    while (deck.items.value.length > 0) {
      deck.items.value.pop();
    }
    // Use a unique ID each time so loadSavedDeck always treats it as a new deck (resets stacks)
    deck.loadSavedDeck({
      id: `reset-${++resetCounter}`,
      name: "reset",
      cards: [],
      userId: "",
      createdAt: "",
      updatedAt: "",
    });
  });

  it("undo after addCard restores previous state", () => {
    const card = makeCard("1");
    deck.addCard(card);
    expect(deck.items.value.length).toBe(1);
    deck.undo();
    expect(deck.items.value.length).toBe(0);
  });

  it("removeCard stops at 0 and keeps the entry visible", () => {
    const card = makeCard("1");
    deck.addCard(card);
    deck.removeCard("test", "1");
    expect(deck.items.value.length).toBe(1);
    expect(deck.items.value[0].count).toBe(0);
  });

  it("removeCard on a 0-count entry is a no-op", () => {
    const card = makeCard("1");
    deck.addCard(card);
    deck.removeCard("test", "1");
    deck.removeCard("test", "1");
    expect(deck.items.value[0].count).toBe(0);
  });

  it("addCard on a 0-count entry increments back to 1", () => {
    const card = makeCard("1");
    deck.addCard(card);
    deck.removeCard("test", "1");
    expect(deck.items.value[0].count).toBe(0);
    deck.addCard(card);
    expect(deck.items.value.length).toBe(1);
    expect(deck.items.value[0].count).toBe(1);
  });

  it("incrementCard on a 0-count entry goes to 1", () => {
    const card = makeCard("1");
    deck.addCard(card);
    deck.removeCard("test", "1");
    deck.incrementCard("test", "1");
    expect(deck.items.value[0].count).toBe(1);
  });

  it("undo after removeCard restores previous count", () => {
    const card = makeCard("1");
    deck.addCard(card);
    deck.removeCard("test", "1");
    expect(deck.items.value[0].count).toBe(0);
    deck.undo();
    expect(deck.items.value[0].count).toBe(1);
  });

  it("undo after incrementCard restores previous count", () => {
    const card = makeCard("1");
    deck.addCard(card);
    deck.incrementCard("test", "1");
    expect(deck.items.value[0].count).toBe(2);
    deck.undo();
    expect(deck.items.value[0].count).toBe(1);
  });

  it("undo after clear restores all cards", () => {
    deck.addCard(makeCard("1"));
    deck.addCard(makeCard("2"));
    expect(deck.items.value.length).toBe(2);
    deck.clear();
    expect(deck.items.value.length).toBe(0);
    deck.undo();
    expect(deck.items.value.length).toBe(2);
  });

  it("undo after importDeck (replace) restores previous deck", () => {
    deck.addCard(makeCard("1"));
    const importItems = [makeItem("2"), makeItem("3")];
    deck.importDeck(importItems, "replace");
    expect(deck.items.value.length).toBe(2);
    deck.undo();
    expect(deck.items.value.length).toBe(1);
    expect(deck.items.value[0].localId).toBe("1");
  });

  it("undo after replaceByName restores old entries", () => {
    const card1 = makeCard("1", "Pikachu");
    deck.addCard(card1);
    const newCard = makeCard("2", "Pikachu");
    deck.replaceByName("Pikachu", [{ card: newCard, count: 2 }]);
    expect(deck.items.value[0].localId).toBe("2");
    expect(deck.items.value[0].count).toBe(2);
    deck.undo();
    expect(deck.items.value[0].localId).toBe("1");
    expect(deck.items.value[0].count).toBe(1);
  });

  it("redo after undo re-applies the mutation", () => {
    deck.addCard(makeCard("1"));
    deck.undo();
    expect(deck.items.value.length).toBe(0);
    deck.redo();
    expect(deck.items.value.length).toBe(1);
  });

  it("new mutation clears redo stack", () => {
    deck.addCard(makeCard("1"));
    deck.undo();
    expect(deck.canRedo.value).toBe(true);
    deck.addCard(makeCard("2"));
    expect(deck.canRedo.value).toBe(false);
  });

  it("loadSavedDeck resets stacks when switching to a different deck", () => {
    deck.addCard(makeCard("1"));
    deck.addCard(makeCard("2"));
    expect(deck.canUndo.value).toBe(true);
    deck.loadSavedDeck({
      id: "different-deck",
      name: "Different Deck",
      cards: [{ count: 1, card: makeCard("3") }],
      userId: "",
      createdAt: "",
      updatedAt: "",
    });
    expect(deck.canUndo.value).toBe(false);
    expect(deck.canRedo.value).toBe(false);
  });

  it("loadSavedDeck preserves undo when reloading the same deck", () => {
    // Load a deck first
    deck.loadSavedDeck({
      id: "same-deck",
      name: "My Deck",
      cards: [{ count: 2, card: makeCard("1") }],
      userId: "",
      createdAt: "",
      updatedAt: "",
    });
    // Make a change
    deck.addCard(makeCard("2"));
    expect(deck.items.value.length).toBe(2);

    // Reload the same deck (e.g. after variant picker)
    deck.loadSavedDeck({
      id: "same-deck",
      name: "My Deck",
      cards: [{ count: 1, card: makeCard("1") }, { count: 1, card: makeCard("3") }],
      userId: "",
      createdAt: "",
      updatedAt: "",
    });
    expect(deck.items.value.length).toBe(2);
    expect(deck.items.value[1].localId).toBe("3");

    // Undo should restore the state before reload
    expect(deck.canUndo.value).toBe(true);
    deck.undo();
    expect(deck.items.value.length).toBe(2);
    expect(deck.items.value[1].localId).toBe("2");
  });

  it("stack caps at 50 entries", () => {
    for (let i = 0; i < 55; i++) {
      deck.addCard(makeCard(`card-${i}`));
    }
    // Should have at most 50 undo entries
    let undoCount = 0;
    while (deck.canUndo.value) {
      deck.undo();
      undoCount++;
    }
    expect(undoCount).toBe(50);
  });

  it("undo on empty stack is a no-op", () => {
    expect(deck.canUndo.value).toBe(false);
    deck.undo(); // should not throw
    expect(deck.items.value.length).toBe(0);
  });

  it("redo on empty stack is a no-op", () => {
    expect(deck.canRedo.value).toBe(false);
    deck.redo(); // should not throw
    expect(deck.items.value.length).toBe(0);
  });

  it("sweepZeroCount removes only 0-count entries", () => {
    deck.addCard(makeCard("1"));
    deck.addCard(makeCard("2"));
    deck.addCard(makeCard("3"));
    deck.removeCard("test", "2"); // 2 → count 0
    expect(deck.items.value.length).toBe(3);
    expect(deck.hasZeroCount.value).toBe(true);
    deck.sweepZeroCount();
    expect(deck.items.value.length).toBe(2);
    expect(deck.items.value.map((i) => i.localId)).toEqual(["1", "3"]);
    expect(deck.hasZeroCount.value).toBe(false);
  });

  it("sweepZeroCount is undoable", () => {
    deck.addCard(makeCard("1"));
    deck.addCard(makeCard("2"));
    deck.removeCard("test", "2");
    deck.sweepZeroCount();
    expect(deck.items.value.length).toBe(1);
    deck.undo();
    expect(deck.items.value.length).toBe(2);
    expect(deck.items.value[1].count).toBe(0);
  });

  it("sweepZeroCount is a no-op when no 0-count entries exist", () => {
    deck.addCard(makeCard("1"));
    const before = deck.canUndo.value;
    deck.sweepZeroCount();
    expect(deck.items.value.length).toBe(1);
    // Should not have pushed a new undo frame
    expect(deck.canUndo.value).toBe(before);
  });

  it("canUndo/canRedo reflect state correctly", () => {
    expect(deck.canUndo.value).toBe(false);
    expect(deck.canRedo.value).toBe(false);

    deck.addCard(makeCard("1"));
    expect(deck.canUndo.value).toBe(true);
    expect(deck.canRedo.value).toBe(false);

    deck.undo();
    expect(deck.canUndo.value).toBe(false);
    expect(deck.canRedo.value).toBe(true);

    deck.redo();
    expect(deck.canUndo.value).toBe(true);
    expect(deck.canRedo.value).toBe(false);
  });
});
