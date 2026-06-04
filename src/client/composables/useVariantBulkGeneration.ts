import { ref, computed, type Ref } from "vue";
import type { Card } from "../../shared/types/card.js";
import { bulkGenerateClean } from "./usePokeproxy.js";
import { useToast } from "./useToast.js";

/**
 * "Generate all same-name variants" in one click. Queues via bulkGenerateClean,
 * which dedupes in-flight requests and skips already-generated cards. Auth gating
 * mirrors BrowseGenerateButton.
 */
export function useVariantBulkGeneration(
  variants: Ref<Card[] | undefined>,
  isLoggedIn: Ref<boolean>,
  isAuthorized: Ref<boolean>,
) {
  const generatingAllVariants = ref(false);

  const generateAllVariantsDisabledReason = computed(() => {
    if (!isLoggedIn.value) return "Sign in to generate";
    if (!isAuthorized.value) return "Your account is not authorized to generate images";
    if (!variants.value?.length) return "No variants to generate";
    if (generatingAllVariants.value) return "Generating...";
    return null;
  });

  async function handleGenerateAllVariants() {
    if (generateAllVariantsDisabledReason.value !== null) return;
    const list = variants.value;
    if (!list?.length) return;
    generatingAllVariants.value = true;
    const toast = useToast();
    try {
      const queued = await bulkGenerateClean(list.map((v) => v.id), false);
      toast.info(`${queued} variant${queued !== 1 ? "s" : ""} queued for generation`);
    } finally {
      generatingAllVariants.value = false;
    }
  }

  return { generatingAllVariants, generateAllVariantsDisabledReason, handleGenerateAllVariants };
}
