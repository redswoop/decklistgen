<script setup lang="ts">
import { computed } from "vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { BOX_MODEL_KEYS, FILL_KEYS } from "../../../shared/constants/prop-defs.js";
import type { EditorElement, PropDef } from "../../../shared/types/editor.js";
import PropRow from "./PropRow.vue";
import FontRow from "./FontRow.vue";
import BoxModelWidget from "./BoxModelWidget.vue";
import FillPicker from "./FillPicker.vue";

const FONT_KEYS: Record<string, boolean> = { fontSize: true, fontFamily: true, fontWeight: true };

const { elements, selectedElementId, selectedChildIndex, selectedGrandchildIndex, selectedNode, selectItem } = useEditorState();
const { rerender, debouncedRerender } = useEditorRenderer();

const selectedElement = computed(() => {
  if (!selectedElementId.value) return null;
  return elements.value.find((e) => e.id === selectedElementId.value) ?? null;
});

const selectedChild = computed(() => {
  if (!selectedElement.value || selectedChildIndex.value == null) return null;
  return selectedElement.value.children?.[selectedChildIndex.value] ?? null;
});

// Filter prop defs to exclude box model and fill keys (those get their own widgets)
const filteredPropDefs = computed(() => {
  if (!selectedNode.value) return [];
  return selectedNode.value.propDefs.filter((d) => !BOX_MODEL_KEYS[d.key] && !FILL_KEYS[d.key] && !FONT_KEYS[d.key]);
});

const hasFont = computed(() => {
  if (!selectedNode.value) return false;
  return selectedNode.value.propDefs.some((d) => d.key === "fontSize");
});

const hasBoxModel = computed(() => {
  if (!selectedNode.value) return false;
  return selectedNode.value.propDefs.some((d) => BOX_MODEL_KEYS[d.key]);
});

const hasFill = computed(() => {
  if (!selectedNode.value) return false;
  return selectedNode.value.propDefs.some((d) => d.key === "fill");
});

// Text/image subs use "opacity", boxes use "fillOpacity"
const opacityKey = computed(() => {
  if (!selectedNode.value) return "fillOpacity";
  return selectedNode.value.propDefs.some((d) => d.key === "fillOpacity") ? "fillOpacity" : "opacity";
});

const sectionLabel = computed(() => {
  if (!selectedNode.value) return "";
  const n = selectedNode.value;
  if (n.level === 0) {
    const el = selectedElement.value;
    return `${n.node.type}${el?.id ? " \u2014 " + el.id : ""}`;
  }
  if (n.level === 1) return `${n.node.type} #${selectedChildIndex.value}`;
  return `${n.node.type} #${selectedGrandchildIndex.value}`;
});

const keyHint = computed(() => {
  if (!selectedNode.value) return "";
  if (selectedNode.value.level === 0) return "Arrows: move element\nShift+Arrow: move x10";
  return "Arrows: nudge margin\nShift+Arrow: nudge x10\nCtrl+Left/Right: reorder";
});

function onPropUpdate(key: string, value: string | number) {
  if (!selectedNode.value) return;
  selectedNode.value.node.props[key] = value;
  const def = selectedNode.value.propDefs.find((d) => d.key === key);
  if (def?.isPosition) debouncedRerender();
  else rerender();
}

function onBoxModelUpdate(key: string, value: number) {
  if (!selectedNode.value) return;
  selectedNode.value.node.props[key] = value;
  debouncedRerender();
}

function onFillUpdate(color: string, opacity: number) {
  if (!selectedNode.value) return;
  selectedNode.value.node.props.fill = color;
  selectedNode.value.node.props[opacityKey.value] = opacity;
  rerender();
}

function addChild(childType: string) {
  const el = selectedElement.value;
  if (!el?.children) return;
  let newChild: EditorElement;
  if (childType === "text") {
    newChild = { type: "text", props: { text: "Text", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" } };
  } else if (childType === "text-wrap") {
    newChild = { type: "text", props: { text: "Description text", fontSize: 20, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 1, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" } };
  } else if (childType === "image-logo") {
    newChild = { type: "image", props: { src: "logo", suffix: "VSTAR", height: 55, filter: "none", opacity: 1, clipToCard: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" } };
  } else if (childType === "image-energy") {
    newChild = { type: "image", props: { src: "energy", energyType: "Fire", radius: 28, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } };
  } else {
    newChild = { type: "box", props: { direction: "row" }, children: [] };
  }
  el.children.push(newChild);
  rerender();
}

function addGrandchild(gcType: string) {
  const child = selectedChild.value;
  if (!child) return;
  let newGc: EditorElement;
  if (gcType === "text") {
    newGc = { type: "text", props: { text: "Text", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" } };
  } else if (gcType === "image-logo") {
    newGc = { type: "image", props: { src: "logo", suffix: "VSTAR", height: 55, filter: "none", opacity: 1, clipToCard: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" } };
  } else {
    newGc = { type: "image", props: { src: "energy", energyType: "Fire", radius: 28, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } };
  }
  if (!child.children) child.children = [];
  child.children.push(newGc);
  rerender();
}

function removeChild() {
  const el = selectedElement.value;
  if (!el?.children || selectedChildIndex.value == null) return;
  el.children.splice(selectedChildIndex.value, 1);
  selectItem(selectedElementId.value);
  rerender();
}

function removeGrandchild() {
  const child = selectedChild.value;
  if (!child?.children || selectedGrandchildIndex.value == null) return;
  child.children.splice(selectedGrandchildIndex.value, 1);
  selectItem(selectedElementId.value, selectedChildIndex.value);
  rerender();
}
</script>

<template>
  <div class="props-panel">
    <div v-if="!selectedNode" class="no-selection">Click an element to select it</div>
    <template v-else>
      <div class="section-label">{{ sectionLabel }}</div>

      <FontRow
        v-if="hasFont"
        :font-size="Number(selectedNode.node.props.fontSize || 24)"
        :font-family="String(selectedNode.node.props.fontFamily || 'title')"
        :font-weight="String(selectedNode.node.props.fontWeight || 'bold')"
        @update="onPropUpdate"
      />

      <PropRow
        v-for="def in filteredPropDefs"
        :key="def.key"
        :def="def"
        :value="selectedNode.node.props[def.key]"
        @update="onPropUpdate"
      />

      <FillPicker
        v-if="hasFill"
        :color="String(selectedNode.node.props.fill || '')"
        :opacity="Number(selectedNode.node.props[opacityKey] ?? 1)"
        @update="onFillUpdate"
      />

      <BoxModelWidget
        v-if="hasBoxModel"
        :values="selectedNode.node.props"
        @update="onBoxModelUpdate"
      />

      <!-- Element level: add child buttons -->
      <template v-if="selectedNode.level === 0 && selectedElement?.children">
        <div class="section-label">Children ({{ selectedElement.children.length }})</div>
        <div class="add-child-bar">
          <button @click="addChild('text')">+ Text</button>
          <button @click="addChild('text-wrap')">+ Wrap Text</button>
          <button @click="addChild('image-energy')">+ Energy</button>
          <button @click="addChild('image-logo')">+ Logo</button>
          <button @click="addChild('box')">+ Box</button>
        </div>
      </template>

      <!-- Child level: add grandchild buttons for box children -->
      <template v-if="selectedNode.level === 1 && selectedChild?.type === 'box'">
        <div class="section-label">Children ({{ selectedChild.children?.length ?? 0 }})</div>
        <div class="add-child-bar">
          <button @click="addGrandchild('text')">+ Text</button>
          <button @click="addGrandchild('image-energy')">+ Energy</button>
          <button @click="addGrandchild('image-logo')">+ Logo</button>
        </div>
      </template>

      <!-- Remove buttons -->
      <button v-if="selectedNode.level === 1" class="remove-btn" @click="removeChild">Remove Child</button>
      <button v-if="selectedNode.level === 2" class="remove-btn" @click="removeGrandchild">Remove</button>

      <div class="key-hint">{{ keyHint }}</div>
    </template>
  </div>
</template>

<style scoped>
.props-panel { padding: 12px; overflow-y: auto; flex: 1; }
.section-label { font-size: 11px; color: #4a9eff; text-transform: uppercase; letter-spacing: 0.5px; margin: 10px 0 6px; border-bottom: 1px solid #333; padding-bottom: 4px; }
.no-selection { padding: 12px; font-size: 12px; color: #666; font-style: italic; }
.key-hint { font-size: 10px; color: #555; margin-top: 8px; line-height: 1.5; white-space: pre-line; }
.add-child-bar { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.add-child-bar button { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
.add-child-bar button:hover { background: #1a5276; }
.remove-btn { background: #3a1a1a; color: #e88; border: 1px solid #744; border-radius: 3px; padding: 4px 10px; font-size: 11px; cursor: pointer; margin-top: 10px; }
.remove-btn:hover { background: #5a2a2a; }
</style>
