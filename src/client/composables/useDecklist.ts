import { ref, computed, watch } from "vue";
import type { Card } from "../../shared/types/card.js";
import type { DecklistEntry } from "../../shared/types/decklist.js";

export interface DecklistItem extends DecklistEntry {
  imageUrl: string;
  card: Card;
}

export interface DeckStats {
  pokemon: { total: number; basic: number; stage1: number; stage2: number; ex: number; v: number };
  trainer: { total: number; supporter: number; item: number; stadium: number; tool: number };
  energy: { total: number };
}

const STORAGE_KEY = "decklistgen-decklist";
const DECK_SIZE = 60;

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

  function importDeck(newItems: DecklistItem[], mode: "merge" | "replace") {
    if (mode === "replace") {
      items.value = newItems;
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

  return {
    items, addCard, incrementCard, removeCard, clear, importDeck,
    totalCards, countColor, stats, DECK_SIZE,
    toText, isInDeck, getDeckCount,
  };
}
