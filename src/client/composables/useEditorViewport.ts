import { ref, computed } from "vue";

const zoomLevel = ref(0.55);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const spaceHeld = ref(false);

let panStartX = 0;
let panStartY = 0;
let panStartPanX = 0;
let panStartPanY = 0;

const transform = computed(() => {
  return { zoom: zoomLevel.value, panX: panX.value, panY: panY.value };
});

const zoomPercent = computed(() => Math.round(zoomLevel.value * 100));

export function useEditorViewport() {
  function setZoom(pct: number) {
    zoomLevel.value = Math.min(2, Math.max(0.2, pct / 100));
  }

  function zoomToFit(innerEl: HTMLElement | null, areaEl: HTMLElement | null) {
    if (!innerEl || !areaEl) return;
    // Temporarily reset to measure natural size
    const saved = innerEl.style.transform;
    innerEl.style.transform = "none";
    const iw = innerEl.scrollWidth;
    const ih = innerEl.scrollHeight;
    innerEl.style.transform = saved;
    const aw = areaEl.clientWidth;
    const ah = areaEl.clientHeight;
    if (iw > 0 && ih > 0) {
      zoomLevel.value = Math.min(2, Math.max(0.2, Math.min(aw / iw, ah / ih) * 0.95));
    }
    panX.value = 0;
    panY.value = 0;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.02 : 0.02;
    zoomLevel.value = Math.min(2, Math.max(0.2, zoomLevel.value + delta));
  }

  function startPan(e: MouseEvent) {
    isPanning.value = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartPanX = panX.value;
    panStartPanY = panY.value;
  }

  function onPanMove(e: MouseEvent) {
    if (!isPanning.value) return;
    panX.value = panStartPanX + (e.clientX - panStartX);
    panY.value = panStartPanY + (e.clientY - panStartY);
  }

  function endPan() {
    isPanning.value = false;
  }

  function onSpaceDown(e: KeyboardEvent) {
    if (e.code === "Space" && !e.repeat && !spaceHeld.value) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      e.preventDefault();
      spaceHeld.value = true;
    }
  }

  function onSpaceUp(e: KeyboardEvent) {
    if (e.code === "Space" && spaceHeld.value) {
      spaceHeld.value = false;
    }
  }

  return {
    zoomLevel,
    panX,
    panY,
    isPanning,
    spaceHeld,
    transform,
    zoomPercent,
    setZoom,
    zoomToFit,
    onWheel,
    startPan,
    onPanMove,
    endPan,
    onSpaceDown,
    onSpaceUp,
  };
}
