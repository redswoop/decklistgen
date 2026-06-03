import { ref, computed, watch, type Ref } from "vue";

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
  const previewMode = ref<PreviewMode>(
    (localStorage.getItem(PREVIEW_MODE_KEY) as PreviewMode) || "editing",
  );
  watch(previewMode, (m) => localStorage.setItem(PREVIEW_MODE_KEY, m));

  const editingThumbWidth = ref<number>(
    Number(localStorage.getItem(EDITING_ZOOM_KEY)) || 180,
  );
  watch(editingThumbWidth, (w) => localStorage.setItem(EDITING_ZOOM_KEY, String(w)));

  const previewThumbWidth = computed(() =>
    previewMode.value === "physical"
      ? Math.round(physicalCardPx.value.w)
      : editingThumbWidth.value,
  );

  return { previewMode, editingThumbWidth, previewThumbWidth };
}
