import { computed, type Ref } from "vue";
import { usePersistentRef, numberSerde } from "./usePersistentRef.js";

export type PreviewMode = "editing" | "physical";

const PREVIEW_MODE_KEY = "decklistgen-gallery-preview-mode";
const EDITING_ZOOM_KEY = "decklistgen-gallery-zoom";

/**
 * Gallery thumbnail sizing. "editing" mode uses a user-set zoom width; "physical"
 * mode renders at the calibrated real-world card width. Both the mode and the
 * editing zoom persist across reload. `physicalCardPx` comes from
 * useDisplayCalibration.
 */
export function useGalleryPreview(physicalCardPx: Ref<{ w: number; h: number }>) {
  const previewMode = usePersistentRef<PreviewMode>(PREVIEW_MODE_KEY, "editing");
  const editingThumbWidth = usePersistentRef(EDITING_ZOOM_KEY, 180, numberSerde);

  const previewThumbWidth = computed(() =>
    previewMode.value === "physical"
      ? Math.round(physicalCardPx.value.w)
      : editingThumbWidth.value,
  );

  return { previewMode, editingThumbWidth, previewThumbWidth };
}
