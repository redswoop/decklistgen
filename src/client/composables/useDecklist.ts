import { ref, computed, watch } from "vue";
import type { Card } from "../../shared/types/card.js";
import type { DecklistEntry } from "../../shared/types/decklist.js";

export interface DecklistItem extends DecklistEntry {
  imageUrl: string;
  card: Card;
}

const STORAGE_KEY = "decklistgen-decklist";

function loadItems(): DecklistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

const items = ref<DecklistItem[]>(loadItems());

watch(items, (val) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
}, { deep: true });

export function useDecklist() {
  function addCard(card: Card) {
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
        imageUrl: card.imageUrl,
        card,
      });
    }
  }

  function incrementCard(setCode: string, localId: string) {
    const item = items.value.find(
      (i) => i.setCode === setCode && i.localId === localId
    );
    if (item) item.count++;
  }

  function removeCard(setCode: string, localId: string) {
    const idx = items.value.findIndex(
      (i) => i.setCode === setCode && i.localId === localId
    );
    if (idx === -1) return;
    if (items.value[idx].count > 1) {
      items.value[idx].count--;
    } else {
      items.value.splice(idx, 1);
    }
  }

  function clear() {
    items.value = [];
  }

  const totalCards = computed(() =>
    items.value.reduce((sum, i) => sum + i.count, 0)
  );

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

  return { items, addCard, incrementCard, removeCard, clear, totalCards, toText, isInDeck, getDeckCount };
}
