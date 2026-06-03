import { ref, computed, type Ref } from "vue";
import type { Card } from "../../shared/types/card.js";
import { api } from "../lib/client.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import {
  usePokeproxyStatus,
  isGenerating,
  generateCleanImage,
  getGenerationVersion,
} from "./usePokeproxy.js";
import { useCardDetail } from "./useCardDetail.js";
import type { CardVersion } from "./useCardVersion.js";
import { resolveMainImageUrl, resolveZoomImageUrl } from "../lib/card-image-resolution.js";

/**
 * Resolves the lightbox's images (background / main / zoom) for the current card
 * and selected version, plus the generation state (generating / needs-generation
 * / can-regenerate) and the clean/regenerate actions. The version→URL choice is
 * the pure card-image-resolution helpers; everything else wires the pokeproxy
 * status + generation-version reactivity.
 */
export function useCardImageResolution(
  currentCard: Ref<Card>,
  selectedVersion: Ref<CardVersion>,
  isAuthorized: Ref<boolean>,
) {
  const currentCardId = computed(() => currentCard.value.id);
  const lightboxOpen = ref(true);
  const { data: cardDetail } = useCardDetail(currentCardId, lightboxOpen);
  const { data: ppStatus } = usePokeproxyStatus(currentCardId);

  const hasCleanedImage = computed(() =>
    !!(ppStatus.value?.hasClean || ppStatus.value?.hasComposite),
  );

  const localBust = ref(0);
  const cacheBust = computed(() =>
    getGenerationVersion(currentCard.value.id) + localBust.value,
  );

  const cleanedImageUrl = computed<string | null>(() => {
    if (!ppStatus.value) return null;
    const v = cacheBust.value;
    if (ppStatus.value.hasComposite) return api.pokeproxyImageUrl(currentCard.value.id, "composite", v);
    if (ppStatus.value.hasClean) return api.pokeproxyImageUrl(currentCard.value.id, "clean", v);
    return null;
  });

  const bgImageUrl = computed(() =>
    cleanedImageUrl.value ?? (cardImageUrl(currentCard.value.imageBase, "low") || null),
  );

  const mainImageUrl = computed(() =>
    resolveMainImageUrl(selectedVersion.value, {
      cleanedUrl: cleanedImageUrl.value,
      hasClean: hasCleanedImage.value,
      imageBase: currentCard.value.imageBase,
    }),
  );

  const zoomImageUrl = computed(() =>
    resolveZoomImageUrl(selectedVersion.value, {
      cleanedUrl: cleanedImageUrl.value,
      imageBase: currentCard.value.imageBase,
    }),
  );

  const generating = computed(() => isGenerating(currentCard.value.id));

  function handleGenerate() {
    generateCleanImage(currentCard.value.id);
  }
  function handleRegenerate() {
    generateCleanImage(currentCard.value.id, true);
  }

  // Whether the current version needs a cleaned image that doesn't exist yet.
  const needsGeneration = computed(() => {
    if (generating.value) return false;
    if (selectedVersion.value === "cleaned" && !cleanedImageUrl.value) return true;
    if (selectedVersion.value === "proxy" && !hasCleanedImage.value) return true;
    return false;
  });

  // Regenerate is offered when a cleaned image exists and we're in cleaned/proxy.
  const canRegenerate = computed(() => {
    if (generating.value) return false;
    if (selectedVersion.value === "original") return false;
    return hasCleanedImage.value && isAuthorized.value;
  });

  return {
    cardDetail, hasCleanedImage, cleanedImageUrl, bgImageUrl, mainImageUrl, zoomImageUrl,
    generating, needsGeneration, canRegenerate, handleGenerate, handleRegenerate,
  };
}
