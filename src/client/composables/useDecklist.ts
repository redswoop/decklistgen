import { ref, computed } from "vue";
import type { Card } from "../../shared/types/card.js";
import type { DecklistEntry } from "../../shared/types/decklist.js";

export interface DecklistItem extends DecklistEntry {
  imageUrl: string;
}

const items = ref<DecklistItem[]>([]);

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

  return { items, addCard, incrementCard, removeCard, clear, totalCards, toText };
}
