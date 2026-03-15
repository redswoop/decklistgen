<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { useEditorViewport } from "../../composables/useEditorViewport.js";
import { useEditorApi } from "../../composables/useEditorApi.js";
import { svgPathToTemplatePath, templatePathToSvgTargets } from "../../composables/useEditorTreeNav.js";

const { selectedPath, selectPath, elements, resolveNode, getNodeChildren, currentCardId } = useEditorState();
const { svgHtml } = useEditorRenderer();
const { zoomLevel, panX, panY, isPanning, spaceHeld, onWheel, startPan, onPanMove, endPan } = useEditorViewport();
const api = useEditorApi();

const cardsArea = ref<HTMLElement | null>(null);
const cardsInner = ref<HTMLElement | null>(null);

defineExpose({ cardsArea, cardsInner });

function getTransformStyle() {
  if (!cardsInner.value) return "";
  const hw = cardsInner.value.scrollWidth / 2;
  const hh = cardsInner.value.scrollHeight / 2;
  const tx = panX.value - hw * zoomLevel.value;
  const ty = panY.value - hh * zoomLevel.value;
  return `translate(${tx}px,${ty}px) scale(${zoomLevel.value})`;
}

function onMouseDown(e: MouseEvent) {
  if (e.button === 1 || (e.button === 0 && spaceHeld.value) || (e.button === 0 && isBackground(e))) {
    e.preventDefault();
    startPan(e);
  }
}

function isBackground(e: MouseEvent | TouchEvent): boolean {
  const target = (e.target ?? e) as HTMLElement;
  return target === cardsArea.value || target === cardsInner.value || target.classList.contains("ref-card");
}

// ── Touch support ──
let touchStartX = 0;
let touchStartY = 0;
let lastPinchDist = 0;

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1 && isBackground(e)) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    startPan({ clientX: touchStartX, clientY: touchStartY } as MouseEvent);
  } else if (e.touches.length === 2) {
    lastPinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 1 && isPanning.value) {
    e.preventDefault();
    onPanMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as MouseEvent);
  } else if (e.touches.length === 2) {
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
    if (lastPinchDist > 0) {
      const delta = (dist - lastPinchDist) * 2;
      onWheel({ deltaY: -delta, preventDefault() {} } as WheelEvent);
    }
    lastPinchDist = dist;
  }
}

function onTouchEnd() {
  endPan();
  lastPinchDist = 0;
}

function onCanvasClick(e: MouseEvent) {
  let node = e.target as HTMLElement | null;
  const indices: number[] = [];
  let elementId: string | null = null;

  while (node && node.tagName !== "svg") {
    if (node.dataset?.childIndex != null) {
      indices.unshift(parseInt(node.dataset.childIndex));
    }
    if (node.dataset?.elementId) {
      elementId = node.dataset.elementId;
      break;
    }
    node = node.parentElement;
  }

  if (elementId) {
    const templatePath = svgPathToTemplatePath(elementId, indices, elements.value, getNodeChildren);
    selectPath(templatePath);
  } else {
    selectPath([]);
  }
}

// Selection highlight
function showSelection() {
  const wrap = document.getElementById("editor-canvas-wrap");
  if (!wrap) return;
  const svgEl = wrap.querySelector("svg");
  if (!svgEl) return;
  for (const old of svgEl.querySelectorAll(".selection-rect")) old.remove();
  if (selectedPath.value.length === 0) return;

  const targets = templatePathToSvgTargets(selectedPath.value, svgEl, elements.value, getNodeChildren);

  for (const target of targets) {
    try {
      const bbox = (target as SVGGraphicsElement).getBBox();
      if (bbox.width === 0 && bbox.height === 0) continue;
      let tx = 0, ty = 0;
      let n: Element | null = target;
      while (n && n !== svgEl) {
        const t = n.getAttribute("transform") || "";
        const i = t.indexOf("translate(");
        if (i >= 0) {
          const inner = t.substring(i + 10, t.indexOf(")", i));
          const parts = inner.includes(",") ? inner.split(",") : inner.split(" ");
          if (parts.length >= 2) { tx += parseFloat(parts[0]); ty += parseFloat(parts[1]); }
        }
        n = n.parentElement;
      }
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(bbox.x + tx - 3));
      rect.setAttribute("y", String(bbox.y + ty - 3));
      rect.setAttribute("width", String(bbox.width + 6));
      rect.setAttribute("height", String(bbox.height + 6));
      rect.classList.add("selection-rect");
      svgEl.appendChild(rect);
    } catch { /* empty group */ }
  }
}

// After SVG is injected, wire up click + selection
watch(svgHtml, async () => {
  await nextTick();
  const wrap = document.getElementById("editor-canvas-wrap");
  if (!wrap) return;
  const svgEl = wrap.querySelector("svg");
  if (svgEl) {
    svgEl.addEventListener("click", onCanvasClick);
    showSelection();
  }
});

// Update selection highlight when selection changes
watch(selectedPath, () => {
  showSelection();
}, { deep: true });
</script>

<template>
  <div
    ref="cardsArea"
    class="cards-area"
    :class="{ panning: isPanning || spaceHeld }"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onPanMove"
    @mouseup="endPan"
    @touchstart="onTouchStart"
    @touchmove.prevent="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      ref="cardsInner"
      class="cards-inner"
      :style="{ transform: getTransformStyle() }"
    >
      <div class="ref-card">
        <img v-if="currentCardId" :src="api.rawImageUrl(currentCardId)" alt="Reference" />
      </div>
      <div id="editor-canvas-wrap" class="canvas-wrap" v-html="svgHtml" />
    </div>
  </div>
</template>

<style scoped>
.cards-area { flex: 1; overflow: hidden; background: #111; position: relative; cursor: grab; touch-action: none; }
.cards-area.panning { cursor: grabbing; }
.cards-inner { display: flex; align-items: center; justify-content: center; gap: 24px; position: absolute; top: 50%; left: 50%; transform-origin: 0 0; }
.ref-card { flex-shrink: 0; }
.ref-card img { border-radius: 12px; border: 2px solid #333; }
.canvas-wrap { flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative; }
:deep(.canvas-wrap svg) { cursor: crosshair; }
:deep(.selection-rect) {
  fill: rgba(74, 158, 255, 0.12);
  stroke: #4af;
  stroke-width: 3;
  stroke-dasharray: 8 4;
  stroke-dashoffset: 0;
  pointer-events: none;
  animation: march 0.6s linear infinite;
}
@keyframes march { to { stroke-dashoffset: -12; } }
</style>
