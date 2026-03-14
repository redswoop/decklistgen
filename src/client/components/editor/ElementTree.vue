<script setup lang="ts">
import { ref } from "vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import type { EditorElement } from "../../../shared/types/editor.js";

const { elements, selectedElementId, selectedChildIndex, selectedGrandchildIndex, selectItem, getChildLabel } = useEditorState();
const { rerender } = useEditorRenderer();

// ── Visibility ──
function applyVisibility() {
  const svgEl = document.querySelector("#editor-canvas-wrap svg");
  if (!svgEl || !elements.value) return;
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

function toggleFold(idx: number, childIdx?: number) {
  if (childIdx != null) {
    const child = elements.value[idx].children?.[childIdx];
    if (child) child._collapsed = !child._collapsed;
  } else {
    elements.value[idx]._collapsed = !elements.value[idx]._collapsed;
  }
}

function toggleVisibility(idx: number, childIdx?: number, gcIdx?: number) {
  if (gcIdx != null && childIdx != null) {
    const gc = elements.value[idx].children?.[childIdx]?.children?.[gcIdx];
    if (gc) gc._hidden = !gc._hidden;
  } else if (childIdx != null) {
    const child = elements.value[idx].children?.[childIdx];
    if (child) child._hidden = !child._hidden;
  } else {
    elements.value[idx]._hidden = !elements.value[idx]._hidden;
  }
  applyVisibility();
}

function isElSelected(el: EditorElement): boolean {
  return el.id === selectedElementId.value && selectedChildIndex.value == null;
}

function isChildSelected(el: EditorElement, ci: number): boolean {
  return el.id === selectedElementId.value && selectedChildIndex.value === ci && selectedGrandchildIndex.value == null;
}

function isGcSelected(el: EditorElement, ci: number, gi: number): boolean {
  return el.id === selectedElementId.value && selectedChildIndex.value === ci && selectedGrandchildIndex.value === gi;
}

// ── Drag and Drop ──
const dragInfo = ref<{ idx: number; child: number | null; grandchild: number | null } | null>(null);
const dropIndicator = ref<{ parentIdx: number; childIdx: number | null; gcIdx: number | null; position: "before" | "after" } | null>(null);

function onDragStart(e: DragEvent, idx: number, child: number | null = null, grandchild: number | null = null) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", "");
  dragInfo.value = { idx, child, grandchild };
}

function onDragEnd() {
  dragInfo.value = null;
  dropIndicator.value = null;
}

function getSrcLevel(): number {
  if (!dragInfo.value) return -1;
  return dragInfo.value.grandchild != null ? 2 : dragInfo.value.child != null ? 1 : 0;
}

function onDragOver(e: DragEvent, idx: number, child: number | null = null, gc: number | null = null) {
  if (!dragInfo.value) return;
  const srcLevel = getSrcLevel();
  const tgtLevel = gc != null ? 2 : child != null ? 1 : 0;
  if (srcLevel !== tgtLevel) return;
  if (srcLevel === 1 && dragInfo.value.idx !== idx) return;
  if (srcLevel === 2 && (dragInfo.value.idx !== idx || dragInfo.value.child !== child)) return;

  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const position = e.clientY > rect.top + rect.height / 2 ? "after" : "before";
  dropIndicator.value = { parentIdx: idx, childIdx: child, gcIdx: gc, position };
}

function onDragLeave() {
  dropIndicator.value = null;
}

function onDrop(e: DragEvent, tgtIdx: number, tgtChild: number | null = null, tgtGc: number | null = null) {
  e.preventDefault();
  if (!dragInfo.value) return;
  const srcLevel = getSrcLevel();
  const tgtLevel = tgtGc != null ? 2 : tgtChild != null ? 1 : 0;

  if (srcLevel !== tgtLevel) { dragInfo.value = null; dropIndicator.value = null; return; }

  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const insertAfter = e.clientY > rect.top + rect.height / 2;

  if (srcLevel === 0) {
    let si = dragInfo.value.idx;
    let ti = tgtIdx;
    if (insertAfter) ti++;
    if (si < ti) ti--;
    if (si !== ti) {
      const moved = elements.value.splice(si, 1)[0];
      elements.value.splice(ti, 0, moved);
    }
  } else if (srcLevel === 1) {
    if (dragInfo.value.idx !== tgtIdx) { dragInfo.value = null; dropIndicator.value = null; return; }
    const parent = elements.value[tgtIdx];
    if (!parent.children) { dragInfo.value = null; dropIndicator.value = null; return; }
    let si = dragInfo.value.child!;
    let ti = tgtChild!;
    if (insertAfter) ti++;
    if (si < ti) ti--;
    if (si !== ti) {
      const moved = parent.children.splice(si, 1)[0];
      parent.children.splice(ti, 0, moved);
      if (selectedElementId.value === parent.id && selectedChildIndex.value === si) selectedChildIndex.value = ti;
    }
  } else if (srcLevel === 2) {
    if (dragInfo.value.idx !== tgtIdx || dragInfo.value.child !== tgtChild) { dragInfo.value = null; dropIndicator.value = null; return; }
    const child = elements.value[tgtIdx].children?.[tgtChild!];
    if (!child?.children) { dragInfo.value = null; dropIndicator.value = null; return; }
    let si = dragInfo.value.grandchild!;
    let ti = tgtGc!;
    if (insertAfter) ti++;
    if (si < ti) ti--;
    if (si !== ti) {
      const moved = child.children.splice(si, 1)[0];
      child.children.splice(ti, 0, moved);
      if (selectedGrandchildIndex.value === si) selectedGrandchildIndex.value = ti;
    }
  }

  dragInfo.value = null;
  dropIndicator.value = null;
  rerender();
}

function showDropBefore(idx: number, child: number | null, gc: number | null): boolean {
  if (!dropIndicator.value) return false;
  return dropIndicator.value.parentIdx === idx && dropIndicator.value.childIdx === child && dropIndicator.value.gcIdx === gc && dropIndicator.value.position === "before";
}

function showDropAfter(idx: number, child: number | null, gc: number | null): boolean {
  if (!dropIndicator.value) return false;
  return dropIndicator.value.parentIdx === idx && dropIndicator.value.childIdx === child && dropIndicator.value.gcIdx === gc && dropIndicator.value.position === "after";
}
</script>

<template>
  <div class="element-list">
    <template v-for="(el, i) in elements" :key="el.id ?? i">
      <!-- Drop indicator before element -->
      <div v-if="showDropBefore(i, null, null)" class="drop-indicator" />

      <div
        class="tree-item level-0"
        :class="{ selected: isElSelected(el), dragging: dragInfo?.idx === i && dragInfo?.child == null }"
        draggable="true"
        @click="selectItem(el.id ?? null)"
        @dragstart="onDragStart($event, i)"
        @dragend="onDragEnd"
        @dragover="onDragOver($event, i)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, i)"
      >
        <span
          v-if="el.children && el.children.length > 0"
          class="fold-btn"
          @click.stop="toggleFold(i)"
        >{{ el._collapsed ? '\u25B6' : '\u25BC' }}</span>
        <span v-else class="fold-spacer" />
        <span
          class="vis-btn"
          :class="{ 'is-hidden': el._hidden }"
          @click.stop="toggleVisibility(i)"
        >&#x1F441;</span>
        <span class="item-label">{{ el.id }}</span>
      </div>

      <!-- Drop indicator after element -->
      <div v-if="showDropAfter(i, null, null)" class="drop-indicator" />

      <!-- Children -->
      <template v-if="el.children && el.children.length > 0 && !el._collapsed">
        <template v-for="(child, ci) in el.children" :key="ci">
          <div v-if="showDropBefore(i, ci, null)" class="drop-indicator" />

          <div
            class="tree-item level-1"
            :class="{ selected: isChildSelected(el, ci), dragging: dragInfo?.idx === i && dragInfo?.child === ci && dragInfo?.grandchild == null }"
            draggable="true"
            @click="selectItem(el.id ?? null, ci)"
            @dragstart="onDragStart($event, i, ci)"
            @dragend="onDragEnd"
            @dragover="onDragOver($event, i, ci)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, i, ci)"
          >
            <span
              v-if="child.children && child.children.length > 0"
              class="fold-btn"
              @click.stop="toggleFold(i, ci)"
            >{{ child._collapsed ? '\u25B6' : '\u25BC' }}</span>
            <span v-else class="fold-spacer" />
            <span
              class="vis-btn"
              :class="{ 'is-hidden': child._hidden }"
              @click.stop="toggleVisibility(i, ci)"
            >&#x1F441;</span>
            <span class="item-label">{{ getChildLabel(child) }}</span>
          </div>

          <div v-if="showDropAfter(i, ci, null)" class="drop-indicator" />

          <!-- Grandchildren -->
          <template v-if="child.children && child.children.length > 0 && !child._collapsed">
            <template v-for="(gc, gi) in child.children" :key="gi">
              <div v-if="showDropBefore(i, ci, gi)" class="drop-indicator" />

              <div
                class="tree-item level-2"
                :class="{ selected: isGcSelected(el, ci, gi), dragging: dragInfo?.idx === i && dragInfo?.child === ci && dragInfo?.grandchild === gi }"
                draggable="true"
                @click="selectItem(el.id ?? null, ci, gi)"
                @dragstart="onDragStart($event, i, ci, gi)"
                @dragend="onDragEnd"
                @dragover="onDragOver($event, i, ci, gi)"
                @dragleave="onDragLeave"
                @drop="onDrop($event, i, ci, gi)"
              >
                <span class="fold-spacer" />
                <span
                  class="vis-btn"
                  :class="{ 'is-hidden': gc._hidden }"
                  @click.stop="toggleVisibility(i, ci, gi)"
                >&#x1F441;</span>
                <span class="item-label">{{ getChildLabel(gc) }}</span>
              </div>

              <div v-if="showDropAfter(i, ci, gi)" class="drop-indicator" />
            </template>
          </template>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.element-list { padding: 0 8px; overflow-y: auto; flex: 1; }
.tree-item { display: flex; align-items: center; padding: 3px 4px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-bottom: 1px; border: 1px solid transparent; user-select: none; }
.tree-item:hover { background: #0f3460; }
.tree-item.selected { background: #0f3460; border-color: #4a9eff; }
.tree-item.level-1 { padding-left: 20px; font-size: 12px; color: #aaa; }
.tree-item.level-2 { padding-left: 36px; font-size: 11px; color: #888; }
.tree-item.level-1:hover, .tree-item.level-1.selected { color: #e0e0e0; }
.tree-item.level-2:hover, .tree-item.level-2.selected { color: #e0e0e0; }
.tree-item.dragging { opacity: 0.4; }
.fold-btn { width: 16px; text-align: center; cursor: pointer; color: #888; font-size: 10px; flex-shrink: 0; }
.fold-btn:hover { color: #e0e0e0; }
.fold-spacer { width: 16px; flex-shrink: 0; }
.vis-btn { width: 18px; text-align: center; cursor: pointer; opacity: 0.4; font-size: 11px; flex-shrink: 0; line-height: 1; }
.vis-btn:hover { opacity: 0.8; }
.vis-btn.is-hidden { opacity: 0.15; }
.item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drop-indicator { height: 2px; background: #4a9eff; margin: 0 4px; border-radius: 1px; }
</style>
