import { ref, computed, watch } from "vue";
import type { Card } from "../../shared/types/card.js";
import type { DecklistEntry } from "../../shared/types/decklist.js";
import type { DeckCard, SavedDeck } from "../../shared/types/deck.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";

export interface DecklistItem extends DecklistEntry {
  imageUrl: string;
  card: Card;
  artCard?: Card;
}

export interface DeckStats {
  pokemon: { total: number; basic: number; stage1: number; stage2: number; ex: number; v: number };
  trainer: { total: number; supporter: number; item: number; stadium: number; tool: number };
  energy: { total: number };
}

const STORAGE_KEY = "decklistgen-decklist";
const META_KEY = "decklistgen-deck-meta";
const DECK_SIZE = 60;

function loadItems(): DecklistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const items: DecklistItem[] = JSON.parse(raw);
      // Migrate old imageUrl -> imageBase
      for (const item of items) {
        if ((item.card as any).imageUrl && !item.card.imageBase) {
          item.card.imageBase = (item.card as any).imageUrl.replace(/\/(high|low)\.png$/, "");
          delete (item.card as any).imageUrl;
        }
        // Also migrate the DecklistItem imageUrl to low-res
        if (item.imageUrl && item.card.imageBase) {
          item.imageUrl = cardImageUrl(item.card.imageBase, "low");
        }
      }
      return items;
    }
  } catch {}
  return [];
}

interface DeckMeta {
  deckId: string | null;
  deckName: string;
  importSource: string | null;
  importedAt: string | null;
  lastSavedSnapshot: string;
}

function loadMeta(): DeckMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { deckId: null, deckName: "", importSource: null, importedAt: null, lastSavedSnapshot: "" };
}

const items = ref<DecklistItem[]>(loadItems());

const meta = loadMeta();
const currentDeckId = ref<string | null>(meta.deckId);
const currentDeckName = ref(meta.deckName);
const importSource = ref<string | null>(meta.importSource);
const importedAt = ref<string | null>(meta.importedAt);
const lastSavedSnapshot = ref(meta.lastSavedSnapshot);

// Undo entries carry the deck identity alongside the cards, so undoing a
// clear/import/close puts the saved-deck handle (and its dirty baseline) back
// too — otherwise the cards come back as an orphan "Untitled Deck" that would
// save as a duplicate.
interface UndoEntry {
  items: DecklistItem[];
  meta: DeckMeta;
}
const undoStack = ref<UndoEntry[]>([]);
const redoStack = ref<UndoEntry[]>([]);
const MAX_UNDO = 50;

function cloneItems(src: DecklistItem[]): DecklistItem[] {
  return src.map(i => ({ ...i }));
}

function captureMeta(): DeckMeta {
  return {
    deckId: currentDeckId.value,
    deckName: currentDeckName.value,
    importSource: importSource.value,
    importedAt: importedAt.value,
    lastSavedSnapshot: lastSavedSnapshot.value,
  };
}

function restoreMeta(m: DeckMeta) {
  currentDeckId.value = m.deckId;
  currentDeckName.value = m.deckName;
  importSource.value = m.importSource;
  importedAt.value = m.importedAt;
  lastSavedSnapshot.value = m.lastSavedSnapshot;
}

function captureEntry(): UndoEntry {
  return { items: cloneItems(items.value), meta: captureMeta() };
}

function applyEntry(e: UndoEntry) {
  items.value = e.items;
  restoreMeta(e.meta);
}

function pushUndo() {
  undoStack.value = [...undoStack.value.slice(-(MAX_UNDO - 1)), captureEntry()];
  redoStack.value = [];
}

function resetHistory() {
  undoStack.value = [];
  redoStack.value = [];
}

watch(items, (val) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
}, { deep: true });

function saveMeta() {
  localStorage.setItem(META_KEY, JSON.stringify(captureMeta()));
}

watch(
  [currentDeckId, currentDeckName, importSource, importedAt, lastSavedSnapshot],
  saveMeta,
);

function currentSnapshot(): string {
  return JSON.stringify({
    items: items.value.map((i) => ({ s: i.setCode, l: i.localId, c: i.count })),
  });
}

export function useDecklist() {
  function addCard(card: Card) {
    pushUndo();
    const existing = items.value.find(
      (i) => i.setCode === card.setCode && i.localId === card.localId
    );
    if (existing) {
      existing.count++;
    } else {
      items.value.push({
        setCode: card.setCode,
        localId: card.localId,
        count: 1,
        name: card.name,
        imageUrl: cardImageUrl(card.imageBase, "low"),
        card,
      });
    }
  }

  function incrementCard(setCode: string, localId: string) {
    pushUndo();
    const item = items.value.find(
      (i) => i.setCode === setCode && i.localId === localId
    );
    if (item) item.count++;
  }

  function removeCard(setCode: string, localId: string) {
    pushUndo();
    const item = items.value.find(
      (i) => i.setCode === setCode && i.localId === localId
    );
    if (item && item.count > 0) item.count--;
  }

  function sweepZeroCount() {
    if (!items.value.some((i) => i.count === 0)) return;
    pushUndo();
    items.value = items.value.filter((i) => i.count > 0);
  }

  /** Empty the cards but keep the deck loaded — a saved deck just becomes dirty. Undoable. */
  function clear() {
    pushUndo();
    items.value = [];
  }

  /** Drop the loaded deck entirely: no cards, no identity. Like switching
   *  decks, this starts fresh undo history (the old deck may be deleted). */
  function closeDeck() {
    resetHistory();
    items.value = [];
    restoreMeta({ deckId: null, deckName: "", importSource: null, importedAt: null, lastSavedSnapshot: "" });
  }

  /** Import cards into the working deck.
   *  - "new": start a fresh (unsaved) deck from the import
   *  - "replace": swap the loaded deck's cards for the import, keeping its identity (dirty)
   *  - "merge": add the import's counts into the loaded deck (dirty)
   *  The import never touches the server; a normal Save does. */
  function importDeck(newItems: DecklistItem[], mode: "new" | "merge" | "replace", source?: string) {
    pushUndo();
    if (mode === "new") {
      items.value = newItems;
      restoreMeta({
        deckId: null, deckName: "", lastSavedSnapshot: "",
        importSource: source ?? null, importedAt: new Date().toISOString(),
      });
      return;
    }
    if (mode === "replace") {
      items.value = newItems;
      importSource.value = source ?? null;
      importedAt.value = new Date().toISOString();
      return;
    }
    // Merge: add counts for matching cards, append new ones
    for (const incoming of newItems) {
      const existing = items.value.find(
        (i) => i.setCode === incoming.setCode && i.localId === incoming.localId
      );
      if (existing) {
        existing.count += incoming.count;
      } else {
        items.value.push({ ...incoming });
      }
    }
    if (source && !importSource.value) {
      importSource.value = source;
      importedAt.value = new Date().toISOString();
    }
  }

  /** Load a saved deck into the working deck */
  function loadSavedDeck(deck: SavedDeck) {
    const isSameDeck = currentDeckId.value === deck.id;
    if (isSameDeck) {
      // Reloading same deck (e.g. after variant picker) — preserve undo history
      pushUndo();
    } else {
      // Switching to a different deck — fresh undo history
      resetHistory();
    }
    items.value = deck.cards.map((dc) => ({
      setCode: dc.card.setCode,
      localId: dc.card.localId,
      count: dc.count,
      name: dc.card.name,
      imageUrl: cardImageUrl(dc.card.imageBase, "low"),
      card: dc.card,
      artCard: dc.artCard,
    }));
    currentDeckId.value = deck.id;
    currentDeckName.value = deck.name;
    importSource.value = deck.importSource ?? null;
    importedAt.value = deck.importedAt ?? null;
    lastSavedSnapshot.value = currentSnapshot();
  }

  /** Mark the current deck as just-saved: the server now holds exactly these cards. */
  function markSaved(deckId: string, name: string) {
    currentDeckId.value = deckId;
    currentDeckName.value = name;
    lastSavedSnapshot.value = currentSnapshot();
  }

  /** Rename only. Leaves the dirty baseline alone — a rename says nothing about
   *  whether the cards have been saved. */
  function renameDeck(name: string) {
    currentDeckName.value = name;
  }

  /** Get DeckCard[] for saving to server */
  function toDeckCards(): DeckCard[] {
    return items.value.map((i) => ({
      count: i.count,
      card: i.card,
      ...(i.artCard ? { artCard: i.artCard } : {}),
    }));
  }

  function setCardArtCard(setCode: string, localId: string, artCard: Card | null) {
    pushUndo();
    const item = items.value.find((i) => i.setCode === setCode && i.localId === localId);
    if (item) item.artCard = artCard ?? undefined;
  }

  /** Replace all copies of (fromSetCode, fromLocalId) with the same count of toCard.
   *  Single undo step. The from-entry's count drops to 0 (sweepable). If the
   *  to-card stack doesn't exist yet it's created; if it does, counts are added. */
  function swapCard(fromSetCode: string, fromLocalId: string, toCard: Card) {
    const from = items.value.find((i) => i.setCode === fromSetCode && i.localId === fromLocalId);
    if (!from || from.count <= 0) return;
    if (from.setCode === toCard.setCode && from.localId === toCard.localId) return;
    pushUndo();
    const migrated = from.count;
    from.count = 0;
    const to = items.value.find(
      (i) => i.setCode === toCard.setCode && i.localId === toCard.localId,
    );
    if (to) {
      to.count += migrated;
    } else {
      items.value.push({
        setCode: toCard.setCode,
        localId: toCard.localId,
        count: migrated,
        name: toCard.name,
        imageUrl: cardImageUrl(toCard.imageBase, "low"),
        card: toCard,
      });
    }
  }

  const totalCards = computed(() =>
    items.value.reduce((sum, i) => sum + i.count, 0)
  );

  const countColor = computed(() => {
    const t = totalCards.value;
    if (t === DECK_SIZE) return "#2ea043";
    if (t > DECK_SIZE) return "#e94560";
    return "#d29922";
  });

  const isDirty = computed(() => {
    if (!currentDeckId.value) return items.value.length > 0;
    return currentSnapshot() !== lastSavedSnapshot.value;
  });

  const stats = computed<DeckStats>(() => {
    const result: DeckStats = {
      pokemon: { total: 0, basic: 0, stage1: 0, stage2: 0, ex: 0, v: 0 },
      trainer: { total: 0, supporter: 0, item: 0, stadium: 0, tool: 0 },
      energy: { total: 0 },
    };

    for (const item of items.value) {
      const c = item.card;
      const n = item.count;

      if (c.category === "Pokemon") {
        result.pokemon.total += n;
        const stage = c.stage?.toLowerCase() ?? "";
        if (stage === "basic") result.pokemon.basic += n;
        else if (stage === "stage1") result.pokemon.stage1 += n;
        else if (stage === "stage2") result.pokemon.stage2 += n;
        if (c.isEx) result.pokemon.ex += n;
        if (c.isV || c.isVmax || c.isVstar) result.pokemon.v += n;
      } else if (c.category === "Trainer") {
        result.trainer.total += n;
        if (c.trainerType === "Supporter") result.trainer.supporter += n;
        else if (c.trainerType === "Item") result.trainer.item += n;
        else if (c.trainerType === "Stadium") result.trainer.stadium += n;
        else if (c.trainerType === "Tool") result.trainer.tool += n;
      } else if (c.category === "Energy") {
        result.energy.total += n;
      }
    }

    return result;
  });

  function undo() {
    if (!undoStack.value.length) return;
    redoStack.value = [...redoStack.value, captureEntry()];
    applyEntry(undoStack.value[undoStack.value.length - 1]);
    undoStack.value = undoStack.value.slice(0, -1);
  }

  function redo() {
    if (!redoStack.value.length) return;
    undoStack.value = [...undoStack.value, captureEntry()];
    applyEntry(redoStack.value[redoStack.value.length - 1]);
    redoStack.value = redoStack.value.slice(0, -1);
  }

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  function toText() {
    return items.value
      .map((i) => `${i.setCode} ${i.localId} x${i.count}  # ${i.name}`)
      .join("\n");
  }

  function isInDeck(setCode: string, localId: string): boolean {
    return items.value.some((i) => i.setCode === setCode && i.localId === localId);
  }

  function getDeckCount(setCode: string, localId: string): number {
    return items.value.find((i) => i.setCode === setCode && i.localId === localId)?.count ?? 0;
  }

  /** Replace all entries for a card name with new entries */
  function replaceByName(name: string, newEntries: { card: Card; count: number }[]) {
    pushUndo();
    // Remove all entries with this name
    items.value = items.value.filter((i) => i.name !== name);
    // Add new entries
    for (const entry of newEntries) {
      items.value.push({
        setCode: entry.card.setCode,
        localId: entry.card.localId,
        count: entry.count,
        name: entry.card.name,
        imageUrl: cardImageUrl(entry.card.imageBase, "low"),
        card: entry.card,
      });
    }
  }

  return {
    items, addCard, incrementCard, removeCard, sweepZeroCount, clear, closeDeck, importDeck,
    totalCards, countColor, stats, DECK_SIZE,
    hasZeroCount: computed(() => items.value.some((i) => i.count === 0)),
    toText, isInDeck, getDeckCount,
    replaceByName,
    undo, redo, canUndo, canRedo,
    // Deck management
    currentDeckId, currentDeckName, isDirty,
    importSource, importedAt,
    loadSavedDeck, markSaved, renameDeck, toDeckCards,
    // Per-card art override
    setCardArtCard,
    // Per-printing swap (move all copies of one printing to another)
    swapCard,
  };
}
