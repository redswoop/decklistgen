<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import type { EditorElement } from "../../../shared/types/editor.js";

defineOptions({ name: "TreeNode" });

const props = defineProps<{
  node: EditorElement;
  path: (string | number)[];
  depth: number;
}>();

const { selectedPath, selectPath, getChildLabel, getNodeChildren } = useEditorState();
const { rerender } = useEditorRenderer();

function isSelected(): boolean {
  const sp = selectedPath.value;
  const p = props.path;
  return sp.length === p.length && sp.every((v, i) => v === p[i]);
}

const childNodes = computed(() => getNodeChildren(props.node));

function toggleFold() {
  props.node._collapsed = !props.node._collapsed;
}

function toggleVisibility() {
  props.node._hidden = !props.node._hidden;
  rerender();
}

// ── Drag and Drop ──
const dragInfo = ref<{ path: (string | number)[] } | null>(null);
const dropPosition = ref<"before" | "after" | null>(null);

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", JSON.stringify(props.path));
  dragInfo.value = { path: props.path };
}

function onDragOver(e: DragEvent) {
  // Only accept drags from siblings
  const raw = e.dataTransfer?.types.includes("text/plain");
  if (!raw) return;
  // Check if same parent (same prefix) and same depth
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const pos = e.clientY > rect.top + rect.height / 2 ? "after" : "before";

  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  dropPosition.value = pos;
}

function onDragLeave() {
  dropPosition.value = null;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dropPosition.value = null;
  const raw = e.dataTransfer?.getData("text/plain");
  if (!raw) return;

  let srcPath: (string | number)[];
  try { srcPath = JSON.parse(raw); } catch { return; }

  // Must be siblings (same parent, same depth)
  if (srcPath.length !== props.path.length || srcPath.length < 2) return;
  const srcParent = srcPath.slice(0, -1);
  const tgtParent = props.path.slice(0, -1);
  if (srcParent.length !== tgtParent.length || !srcParent.every((v, i) => v === tgtParent[i])) return;

  const si = srcPath[srcPath.length - 1] as number;
  let ti = props.path[props.path.length - 1] as number;

  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const insertAfter = e.clientY > rect.top + rect.height / 2;
  if (insertAfter) ti++;
  if (si < ti) ti--;
  if (si === ti) return;

  // Find the siblings array
  const { resolveNode } = useEditorState();
  const parentResolved = resolveNode(srcParent);
  if (!parentResolved) return;
  const siblings = getNodeChildren(parentResolved.node);
  if (!siblings) return;

  const moved = siblings.splice(si, 1)[0];
  siblings.splice(ti, 0, moved);

  // Update selection if the moved item was selected
  const sp = selectedPath.value;
  if (sp.length === srcPath.length && srcPath.every((v, i) => v === sp[i])) {
    selectPath([...tgtParent, ti]);
  }

  rerender();
}

function onDragEnd() {
  dragInfo.value = null;
  dropPosition.value = null;
}

const indent = `${16 + props.depth * 16}px`;
</script>

<template>
  <div>
    <!-- Drop indicator before -->
    <div v-if="dropPosition === 'before'" class="drop-indicator" />

    <div
      class="tree-item"
      :class="{
        selected: isSelected(),
        'is-root': depth === 0,
      }"
      :style="{ paddingLeft: indent }"
      draggable="true"
      @click.stop="selectPath(path)"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <span
        v-if="(childNodes?.length ?? 0) > 0"
        class="fold-btn"
        @click.stop="toggleFold()"
      >{{ node._collapsed ? '\u25B6' : '\u25BC' }}</span>
      <span v-else class="fold-spacer" />
      <span
        class="vis-btn"
        :class="{ 'is-hidden': node._hidden }"
        @click.stop="toggleVisibility()"
      >&#x1F441;</span>
      <span class="item-label">{{ depth === 0 ? node.id : getChildLabel(node) }}</span>
    </div>

    <!-- Drop indicator after -->
    <div v-if="dropPosition === 'after'" class="drop-indicator" />

    <!-- Repeater template header -->
    <div
      v-if="node.type === 'repeater' && node.itemTemplate && !node._collapsed"
      class="tree-item repeater-template"
      :style="{ paddingLeft: `${16 + (depth + 1) * 16}px` }"
    >
      <span class="fold-spacer" />
      <span class="item-label repeater-tmpl-label">template: {{ getChildLabel(node.itemTemplate) }}</span>
    </div>

    <!-- Recursive children -->
    <template v-if="!node._collapsed && childNodes?.length">
      <TreeNode
        v-for="(child, ci) in childNodes"
        :key="ci"
        :node="child"
        :path="[...path, ci]"
        :depth="depth + 1"
      />
    </template>
  </div>
</template>

<style scoped>
.tree-item { display: flex; align-items: center; padding: 3px 4px; border-radius: 4px; cursor: pointer; font-size: 12px; color: #aaa; margin-bottom: 1px; border: 1px solid transparent; user-select: none; }
.tree-item.is-root { font-size: 13px; color: #e0e0e0; }
.tree-item:hover { background: #0f3460; color: #e0e0e0; }
.tree-item.selected { background: #0f3460; border-color: #4a9eff; color: #e0e0e0; }
.fold-btn { width: 16px; text-align: center; cursor: pointer; color: #888; font-size: 10px; flex-shrink: 0; }
.fold-btn:hover { color: #e0e0e0; }
.fold-spacer { width: 16px; flex-shrink: 0; }
.vis-btn { width: 18px; text-align: center; cursor: pointer; opacity: 0.4; font-size: 11px; flex-shrink: 0; line-height: 1; }
.vis-btn:hover { opacity: 0.8; }
.vis-btn.is-hidden { opacity: 0.15; }
.item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.repeater-tmpl-label { color: #4a9eff; font-style: italic; font-size: 10px; }
.drop-indicator { height: 2px; background: #4a9eff; margin: 0 4px; border-radius: 1px; }

@media (max-width: 768px) {
  .tree-item { padding: 6px 4px; min-height: 36px; }
  .fold-btn { width: 24px; font-size: 12px; }
  .fold-spacer { width: 24px; }
  .vis-btn { width: 28px; font-size: 14px; }
}
</style>
