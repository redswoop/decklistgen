/** Composable: produce the cards shown in the Gallery grid.
 *
 *  Source order:
 *    1. Unique cards from the currently-loaded deck (via useDecklist).
 *    2. TEST_CARDS reference set, used to fill template buckets the deck
 *       doesn't cover so every template can still be tuned.
 *
 *  Cards are returned in template-grouped order: basic-energy → pokemon-vstar
 *  → pokemon-fullart → trainer → pokemon-standard. Within each bucket, deck
 *  cards come first, then references (with `source: 'reference'`).
 */
import { ref, computed, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "../lib/client.js";
import { useDecklist } from "./useDecklist.js";

export interface GalleryCard {
  label: string;
  cardId: string;
  name: string;
  category: string;
  stage: string | null;
  hp: number | null;
  rarity: string | null;
  energyTypes: string[];
  effect: string | null;
  isFullArt: boolean;
  hasClean: boolean;
  hasComposite: boolean;
  hasSvg: boolean;
  hasSource: boolean;
  cleanMeta: Record<string, unknown> | null;
  promptRule: string | null;
  promptText: string | null;
  promptSkip: boolean;
}

export type CardSource = "deck" | "reference";
export interface GalleryCardWithSource extends GalleryCard {
  source: CardSource;
}

export type TemplateName =
  | "basic-energy"
  | "pokemon-vstar"
  | "pokemon-fullart"
  | "trainer"
  | "pokemon-standard";

const TEMPLATE_ORDER: TemplateName[] = [
  "basic-energy",
  "pokemon-vstar",
  "pokemon-fullart",
  "trainer",
  "pokemon-standard",
];

export function templateForGalleryCard(c: GalleryCard): TemplateName {
  if (c.category === "Energy" && !c.effect) return "basic-energy";
  if (c.category === "Energy" && c.effect) return "trainer";
  if (c.category === "Trainer") return "trainer";
  if (c.stage === "VSTAR") return "pokemon-vstar";
  if (c.isFullArt) return "pokemon-fullart";
  return "pokemon-standard";
}

export function useGalleryCardSource() {
  const { items: deckItems } = useDecklist();

  // Reference set: TEST_CARDS as the server defines them. Cached forever
  // (these are static IDs). Loaded once on first call.
  const referenceCards = useQuery<GalleryCard[]>({
    queryKey: ["gallery-reference-cards"],
    queryFn: () => api.galleryCards(),
    staleTime: 1000 * 60 * 60,
  });

  // Unique deck card IDs, in insertion order.
  const deckCardIds = computed(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const item of deckItems.value) {
      const id = item.card.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  });

  // Pull GalleryCard rows for the deck's unique IDs. Re-queries when the deck
  // changes (TanStack handles deduplication of in-flight requests).
  const deckCardsQuery = useQuery<GalleryCard[]>({
    queryKey: computed(() => ["gallery-deck-cards", deckCardIds.value.join(",")]) as never,
    queryFn: () => api.galleryCards(deckCardIds.value),
    enabled: computed(() => deckCardIds.value.length > 0) as never,
    staleTime: 30_000,
  });

  /** All deck cards as GalleryCardWithSource, in deck order. */
  const deckCards = computed<GalleryCardWithSource[]>(() =>
    (deckCardsQuery.data.value ?? []).map((c) => ({ ...c, source: "deck" as const })),
  );

  /** Reference cards keyed by template, deck cards stripped out. */
  const referenceByTemplate = computed<Record<TemplateName, GalleryCardWithSource[]>>(() => {
    const out: Record<TemplateName, GalleryCardWithSource[]> = {
      "basic-energy": [],
      "pokemon-vstar": [],
      "pokemon-fullart": [],
      "trainer": [],
      "pokemon-standard": [],
    };
    const deckIdSet = new Set(deckCardIds.value);
    for (const c of referenceCards.data.value ?? []) {
      if (deckIdSet.has(c.cardId)) continue;
      out[templateForGalleryCard(c)].push({ ...c, source: "reference" });
    }
    return out;
  });

  /** Deck cards keyed by template. */
  const deckByTemplate = computed<Record<TemplateName, GalleryCardWithSource[]>>(() => {
    const out: Record<TemplateName, GalleryCardWithSource[]> = {
      "basic-energy": [],
      "pokemon-vstar": [],
      "pokemon-fullart": [],
      "trainer": [],
      "pokemon-standard": [],
    };
    for (const c of deckCards.value) {
      out[templateForGalleryCard(c)].push(c);
    }
    return out;
  });

  /** All cards to display in the grid, template-grouped.
   *
   *  - Each template bucket: deck cards first, then references for gap-fill.
   *  - Templates without any deck coverage get reference cards as gap-fillers.
   *  - When the deck is empty, the grid is just the reference set. */
  const previewCards = computed<GalleryCardWithSource[]>(() => {
    const out: GalleryCardWithSource[] = [];
    for (const t of TEMPLATE_ORDER) {
      const deckBucket = deckByTemplate.value[t];
      out.push(...deckBucket);
      // If the deck didn't cover this template at all, drop in the reference
      // cards as gap-fillers so the user can still see / tune that template.
      if (deckBucket.length === 0) {
        out.push(...referenceByTemplate.value[t]);
      }
    }
    return out;
  });

  /** All known card IDs (for warm-loading SVG cache). */
  const allCardIds = computed(() => previewCards.value.map((c) => c.cardId));

  return {
    previewCards,
    deckCards,
    referenceCards: computed(() => referenceCards.data.value ?? []),
    allCardIds,
    isLoading: computed(
      () => referenceCards.isLoading.value || deckCardsQuery.isLoading.value,
    ),
    refetch: async () => {
      await referenceCards.refetch();
      await deckCardsQuery.refetch();
    },
    TEMPLATE_ORDER,
  };
}
