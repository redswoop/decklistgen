<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { useEditorViewport } from "../../composables/useEditorViewport.js";
import { useEditorApi } from "../../composables/useEditorApi.js";

const { selectedElementId, selectedChildIndex, selectedGrandchildIndex, selectItem, currentCardId } = useEditorState();
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

function isBackground(e: MouseEvent): boolean {
  const target = e.target as HTMLElement;
  return target === cardsArea.value || target === cardsInner.value || target.classList.contains("ref-card");
}

function onCanvasClick(e: MouseEvent) {
  let node = e.target as HTMLElement | null;
  let childIdx: number | null = null;
  while (node && node.tagName !== "svg") {
    if (node.dataset?.childIndex != null) {
      childIdx = parseInt(node.dataset.childIndex);
    }
    if (node.dataset?.elementId) {
      selectItem(node.dataset.elementId, childIdx);
      return;
    }
    node = node.parentElement;
  }
  selectItem(null);
}

// Selection highlight
function showSelection() {
  const wrap = document.getElementById("editor-canvas-wrap");
  if (!wrap) return;
  const svgEl = wrap.querySelector("svg");
  if (!svgEl) return;
  const old = svgEl.querySelector(".selection-rect");
  if (old) old.remove();
  if (!selectedElementId.value) return;
  const parentG = svgEl.querySelector(`[data-element-id="${selectedElementId.value}"]`);
  if (!parentG) return;

  let target: Element = parentG;
  if (selectedChildIndex.value != null) {
    const childG = parentG.querySelector(`:scope > [data-child-index="${selectedChildIndex.value}"]`);
    if (childG) target = childG;
  }

  try {
    const bbox = (target as SVGGraphicsElement).getBBox();
    if (bbox.width === 0 && bbox.height === 0) return;
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

// Apply visibility to SVG DOM
function applyVisibility() {
  const { elements } = useEditorState();
  const wrap = document.getElementById("editor-canvas-wrap");
  if (!wrap) return;
  const svgEl = wrap.querySelector("svg");
  if (!svgEl) return;
  for (const el of elements.value) {
    const g = svgEl.querySelector(`[data-element-id="${el.id}"]`) as HTMLElement | null;
    if (!g) continue;
    g.style.display = el._hidden ? "none" : "";
    if (el.children) {
      for (let ci = 0; ci < el.children.length; ci++) {
        const child = el.children[ci];
        const childG = g.querySelector(`:scope > [data-child-index="${ci}"]`) as HTMLElement | null;
        if (!childG) continue;
        childG.style.display = child._hidden ? "none" : "";
        if (child.children) {
          for (let gi = 0; gi < child.children.length; gi++) {
            const gc = child.children[gi];
            const gcG = childG.querySelector(`:scope > g > [data-child-index="${gi}"]`) as HTMLElement | null;
            if (gcG) gcG.style.display = gc._hidden ? "none" : "";
          }
        }
      }
    }
  }
}

// After SVG is injected, wire up click + visibility + selection
watch(svgHtml, async () => {
  await nextTick();
  const wrap = document.getElementById("editor-canvas-wrap");
  if (!wrap) return;
  const svgEl = wrap.querySelector("svg");
  if (svgEl) {
    svgEl.addEventListener("click", onCanvasClick);
    applyVisibility();
    showSelection();
  }
});

// Update selection highlight when selection changes
watch([selectedElementId, selectedChildIndex, selectedGrandchildIndex], () => {
  showSelection();
});
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
.cards-area { flex: 1; overflow: hidden; background: #111; position: relative; cursor: grab; }
.cards-area.panning { cursor: grabbing; }
.cards-inner { display: flex; align-items: center; justify-content: center; gap: 24px; position: absolute; top: 50%; left: 50%; transform-origin: 0 0; }
.ref-card { flex-shrink: 0; }
.ref-card img { border-radius: 12px; border: 2px solid #333; }
.canvas-wrap { flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative; }
:deep(.canvas-wrap svg) { cursor: crosshair; }
:deep(.selection-rect) { fill: none; stroke: #4a9eff; stroke-width: 2; stroke-dasharray: 6 3; pointer-events: none; }
</style>
