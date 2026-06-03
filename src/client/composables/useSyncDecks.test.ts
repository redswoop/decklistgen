import { describe, it, expect } from "bun:test";
import { useSyncDecks } from "./useSyncDecks.js";
import type { DeckSummary } from "../../shared/types/deck.js";

function deck(id: string, name = id): DeckSummary {
  return { id, name, cardCount: 60, updatedAt: "2026-05-01T12:00:00.000Z" } as DeckSummary;
}

describe("useSyncDecks selection", () => {
  it("toggle adds then removes an id", () => {
    const s = useSyncDecks();
    s.remoteDecks.value = [deck("a"), deck("b")];
    s.toggle("a");
    expect(s.selected.value.has("a")).toBe(true);
    s.toggle("a");
    expect(s.selected.value.has("a")).toBe(false);
  });

  it("selectAll / selectNone drive allSelected", () => {
    const s = useSyncDecks();
    s.remoteDecks.value = [deck("a"), deck("b")];
    expect(s.allSelected.value).toBe(false);
    s.selectAll();
    expect(s.selected.value.size).toBe(2);
    expect(s.allSelected.value).toBe(true);
    s.selectNone();
    expect(s.selected.value.size).toBe(0);
    expect(s.allSelected.value).toBe(false);
  });

  it("allSelected is false when the remote list is empty", () => {
    const s = useSyncDecks();
    expect(s.allSelected.value).toBe(false);
  });
});

describe("useSyncDecks phase transitions", () => {
  it("backToConnect resets credentials-in-flight and selection", () => {
    const s = useSyncDecks();
    s.phase.value = "pick";
    s.password.value = "secret";
    s.remoteDecks.value = [deck("a")];
    s.selectAll();
    s.backToConnect();
    expect(s.phase.value).toBe("connect");
    expect(s.password.value).toBe("");
    expect(s.remoteDecks.value).toEqual([]);
    expect(s.selected.value.size).toBe(0);
  });

  it("syncMore returns to pick and clears the prior result", () => {
    const s = useSyncDecks();
    s.phase.value = "result";
    s.result.value = { imported: ["a"], skipped: [], overwritten: [], errors: [] };
    s.syncMore();
    expect(s.phase.value).toBe("pick");
    expect(s.result.value).toBeNull();
  });
});

describe("useSyncDecks deckName", () => {
  it("resolves a name from the remote list, falling back to the id", () => {
    const s = useSyncDecks();
    s.remoteDecks.value = [deck("d-1", "Charizard")];
    expect(s.deckName("d-1")).toBe("Charizard");
    expect(s.deckName("missing")).toBe("missing");
  });
});
