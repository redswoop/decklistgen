import { ref, computed, type Ref } from "vue";
import {
  templateForGalleryCard,
  type GalleryCardWithSource,
} from "./useGalleryCardSource.js";
import {
  filterGalleryCards,
  countByTemplate,
  type TemplateFilter,
} from "../lib/gallery-filter.js";
import { usePersistentRef } from "./usePersistentRef.js";

const FILTER_KEY = "decklistgen-gallery-filter";

/**
 * Gallery template-bucket + name/id search filtering. Owns the persisted
 * templateFilter and the (transient) search ref; derives the per-template counts
 * and the filtered list via the pure gallery-filter helpers.
 */
export function useGalleryFilter(cards: Ref<GalleryCardWithSource[] | undefined>) {
  const templateFilter = usePersistentRef<TemplateFilter>(FILTER_KEY, "all");

  const search = ref("");

  const templateCounts = computed(() =>
    countByTemplate(cards.value ?? [], templateForGalleryCard),
  );

  const filteredCards = computed(() =>
    filterGalleryCards(
      cards.value ?? [],
      { templateFilter: templateFilter.value, search: search.value },
      templateForGalleryCard,
    ),
  );

  return { templateFilter, search, templateCounts, filteredCards };
}
