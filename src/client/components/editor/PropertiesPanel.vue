<script setup lang="ts">
import { computed, ref } from "vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { api } from "../../lib/client.js";
import {
  BOX_MODEL_KEYS, FILL_KEYS,
  H_ALIGN_OPTIONS, V_ALIGN_OPTIONS, TEXT_ANCHOR_OPTIONS,
  DIRECTION_OPTIONS, V_ANCHOR_OPTIONS, H_ANCHOR_OPTIONS, WRAP_OPTIONS,
} from "../../../shared/constants/prop-defs.js";
import type { EditorElement } from "../../../shared/types/editor.js";
import PropRow from "./PropRow.vue";
import FontControls from "./FontControls.vue";
import BoxModelWidget from "./BoxModelWidget.vue";
import ColorField from "./ColorField.vue";
import AlignButtons from "./AlignButtons.vue";
import XYRow from "./XYRow.vue";

const FONT_KEYS: Record<string, boolean> = { fontSize: true, fontFamily: true, fontWeight: true };

const { selectedPath, selectedNode, resolveNode, getNodeChildren, selectPath, cardData, resolveBinding, markDirty } = useEditorState();
const { rerender, debouncedRerender } = useEditorRenderer();

async function onTokenUpdate(tokenName: string, value: number) {
  const data = await api.getFontSizes();
  const overrides = { ...data.current, [tokenName]: value };
  await api.saveFontSizes(overrides);
  rerender();
}

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

function hasProp(key: string): boolean {
  return selectedNode.value?.propDefs.some((d) => d.key === key) ?? false;
}

function hasGroup(group: string): boolean {
  return selectedNode.value?.propDefs.some((d) => d.group === group) ?? false;
}

// Direction options filtered to match the prop def's allowed values (repeater has fewer)
const directionOptions = computed(() => {
  if (!selectedNode.value) return DIRECTION_OPTIONS;
  const def = selectedNode.value.propDefs.find((d) => d.key === "direction");
  if (!def?.options) return DIRECTION_OPTIONS;
  return DIRECTION_OPTIONS.filter((opt) => def.options!.includes(opt.value));
});

const contentDefs = computed(() =>
  selectedNode.value?.propDefs.filter(d => d.group === 'content') ?? []);

const layoutDefs = computed(() =>
  selectedNode.value?.propDefs.filter(d => d.group === 'layout') ?? []);

const appearanceDefs = computed(() =>
  selectedNode.value?.propDefs.filter(d => d.group === 'appearance') ?? []);

const hasWidthGap = computed(() => hasProp('width') && hasProp('gap'));

const layoutSingleDefs = computed(() =>
  layoutDefs.value.filter(d =>
    !(hasWidthGap.value && (d.key === 'width' || d.key === 'gap'))
  ));

// Filter prop defs to exclude grouped, box model, fill, and font keys (safety net)
const filteredPropDefs = computed(() => {
  if (!selectedNode.value) return [];
  return selectedNode.value.propDefs.filter((d) => {
    if (BOX_MODEL_KEYS[d.key]) return false;
    if (FONT_KEYS[d.key]) return false;
    if (d.group) return false;
    if (hasFill.value && FILL_KEYS[d.key]) return false;
    return true;
  });
});

const sectionLabel = computed(() => {
  if (!selectedNode.value) return "";
  const n = selectedNode.value;
  if (n.isRoot) {
    return `${n.node.type} \u2014 ${n.node.id ?? ""}`;
  }
  const idx = selectedPath.value[selectedPath.value.length - 1];
  return `${n.node.type} #${idx}`;
});

const keyHint = computed(() => {
  if (!selectedNode.value) return "";
  if (selectedNode.value.isRoot) return "Arrows: move element\nShift+Arrow: move x10";
  return "Arrows: nudge margin\nShift+Arrow: nudge x10\nCtrl+Left/Right: reorder";
});

/** Can this node have children added to it? */
const canAddChildren = computed(() => {
  if (!selectedNode.value) return false;
  const node = selectedNode.value.node;
  return node.type === "box" || node.type === "repeater";
});

/** The effective children list of the selected node (for display counts). */
const selectedChildren = computed(() => {
  if (!selectedNode.value) return [];
  return getNodeChildren(selectedNode.value.node) ?? [];
});

function onPropUpdate(key: string, value: string | number) {
  if (!selectedNode.value) return;
  selectedNode.value.node.props[key] = value;
  markDirty();
  const def = selectedNode.value.propDefs.find((d) => d.key === key);
  if (def?.isPosition) debouncedRerender();
  else rerender();
}

function onBindingUpdate(key: string, path: string) {
  if (!selectedNode.value) return;
  if (!selectedNode.value.node.bind) selectedNode.value.node.bind = {};
  selectedNode.value.node.bind[key] = path;
  if (cardData.value && !selectedNode.value.insideRepeater) {
    const val = resolveBinding(path, cardData.value);
    if (val !== undefined) {
      selectedNode.value.node.props[key] = val as string | number;
    }
  }
  markDirty();
  rerender();
}

function onBindingClear(key: string) {
  if (!selectedNode.value?.node.bind) return;
  delete selectedNode.value.node.bind[key];
  if (Object.keys(selectedNode.value.node.bind).length === 0) {
    delete selectedNode.value.node.bind;
  }
  markDirty();
}

function onBoxModelUpdate(key: string, value: number) {
  if (!selectedNode.value) return;
  selectedNode.value.node.props[key] = value;
  markDirty();
  debouncedRerender();
}

function addChild(childType: string) {
  if (!selectedNode.value) return;
  const node = selectedNode.value.node;

  let newChild: EditorElement;
  if (childType === "text") {
    newChild = { type: "text", props: { text: "Text", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" } };
  } else if (childType === "text-wrap") {
    newChild = { type: "text", props: { text: "Description text", fontSize: 20, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 1, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" } };
  } else if (childType === "image-logo") {
    newChild = { type: "image", props: { src: "logo", suffix: "VSTAR", height: 55, filter: "none", opacity: 1, clipToCard: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" } };
  } else if (childType === "image-energy") {
    newChild = { type: "image", props: { src: "energy", energyType: "Fire", radius: 28, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } };
  } else if (childType === "repeater") {
    newChild = {
      type: "repeater",
      props: { direction: "row" },
      bind: { items: "" },
      itemTemplate: {
        type: "image", props: { src: "energy", energyType: "Colorless", radius: 14 },
      },
    };
  } else {
    // box
    newChild = { type: "box", props: { direction: "row" }, children: [] };
  }

  if (node.type === "repeater") {
    if (!node.itemTemplate) return;
    if (!node.itemTemplate.children) node.itemTemplate.children = [];
    node.itemTemplate.children.push(newChild);
  } else {
    if (!node.children) node.children = [];
    node.children.push(newChild);
  }
  markDirty();
  rerender();
}

function removeSelected() {
  if (!selectedNode.value || selectedNode.value.isRoot) return;
  const resolved = resolveNode(selectedPath.value);
  if (!resolved?.siblings || resolved.indexInSiblings == null) return;
  resolved.siblings.splice(resolved.indexInSiblings, 1);
  selectPath(selectedPath.value.slice(0, -1));
  markDirty();
  rerender();
}

function onItemsBindingUpdate(path: string) {
  if (!selectedNode.value || selectedNode.value.node.type !== "repeater") return;
  if (!selectedNode.value.node.bind) selectedNode.value.node.bind = {};
  selectedNode.value.node.bind.items = path;
  markDirty();
  rerender();
}

// ── showIf editing ──
const editingShowIf = ref(false);
const showIfInput = ref("");

function onShowIfClick() {
  showIfInput.value = selectedNode.value?.node.showIf ?? "";
  editingShowIf.value = true;
}

function onShowIfSubmit() {
  if (!selectedNode.value) return;
  const path = showIfInput.value.trim();
  if (path) {
    selectedNode.value.node.showIf = path;
  } else {
    delete selectedNode.value.node.showIf;
  }
  editingShowIf.value = false;
  markDirty();
  rerender();
}

function onShowIfKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") onShowIfSubmit();
  else if (e.key === "Escape") editingShowIf.value = false;
}
</script>

<template>
  <div class="props-panel">
    <div v-if="!selectedNode" class="no-selection">Click an element to select it</div>
    <template v-else>
      <div class="section-label">{{ sectionLabel }}</div>

      <!-- showIf editor -->
      <div class="show-if-row">
        <span class="show-if-label">showIf:</span>
        <template v-if="!editingShowIf">
          <span
            v-if="selectedNode.node.showIf"
            class="binding-badge"
            @click="onShowIfClick"
          >{{ selectedNode.node.showIf }}</span>
          <span v-else class="show-if-none" @click="onShowIfClick">none</span>
        </template>
        <input
          v-else
          type="text"
          class="show-if-input"
          v-model="showIfInput"
          placeholder="e.g. abilities"
          @keydown="onShowIfKeydown"
          @blur="onShowIfSubmit"
        />
      </div>

      <!-- 1. Position (root only) -->
      <XYRow
        v-if="hasGroup('position')"
        label="Anchor"
        :x-value="Number(selectedNode.node.props.anchorX || 0)"
        :y-value="Number(selectedNode.node.props.anchorY || 0)"
        x-label="Anchor X"
        y-label="Anchor Y"
        :x-min="-200" :x-max="900" :x-step="1"
        :y-min="-200" :y-max="1100" :y-step="1"
        @update:x="v => onPropUpdate('anchorX', v)"
        @update:y="v => onPropUpdate('anchorY', v)"
      />

      <!-- 2. Content -->
      <PropRow
        v-for="def in contentDefs"
        :key="def.key"
        :def="def"
        :value="selectedNode.node.props[def.key] ?? (def.type === 'number' || def.type === 'range' ? 0 : '')"
        :binding="selectedNode.node.bind?.[def.key]"
        @update="onPropUpdate"
        @update:binding="onBindingUpdate"
        @clear:binding="onBindingClear"
      />

      <!-- 3. Typography -->
      <FontControls
        v-if="hasFont"
        :font-size="selectedNode.node.props.fontSize ?? 24"
        :font-family="String(selectedNode.node.props.fontFamily || 'title')"
        :font-weight="String(selectedNode.node.props.fontWeight || 'bold')"
        @update="onPropUpdate"
        @update-token="onTokenUpdate"
      />
      <div v-if="hasProp('textAnchor')" class="align-pair">
        <AlignButtons
          label="Text Anchor"
          :model-value="String(selectedNode.node.props.textAnchor || 'start')"
          :options="TEXT_ANCHOR_OPTIONS"
          @update:model-value="v => onPropUpdate('textAnchor', v)"
        />
        <AlignButtons
          v-if="hasProp('wrap')"
          label="Wrap"
          :model-value="String(selectedNode.node.props.wrap ?? '0')"
          :options="WRAP_OPTIONS"
          @update:model-value="v => onPropUpdate('wrap', v)"
        />
      </div>

      <!-- 4. Layout -->
      <template v-if="hasGroup('direction')">
        <AlignButtons
          v-if="hasProp('direction')"
          label="Direction"
          :model-value="String(selectedNode.node.props.direction || 'row')"
          :options="directionOptions"
          @update:model-value="v => onPropUpdate('direction', v)"
        />
        <AlignButtons
          v-if="hasProp('vAnchor')"
          label="V-Anchor"
          :model-value="String(selectedNode.node.props.vAnchor || 'top')"
          :options="V_ANCHOR_OPTIONS"
          @update:model-value="v => onPropUpdate('vAnchor', v)"
        />
        <AlignButtons
          v-if="hasProp('hAnchor')"
          label="H-Anchor"
          :model-value="String(selectedNode.node.props.hAnchor || 'left')"
          :options="H_ANCHOR_OPTIONS"
          @update:model-value="v => onPropUpdate('hAnchor', v)"
        />
      </template>
      <div v-if="hasGroup('align')" class="align-pair">
        <AlignButtons
          v-if="hasProp('hAlign')"
          label="H-Align"
          :model-value="String(selectedNode.node.props.hAlign || 'start')"
          :options="H_ALIGN_OPTIONS"
          @update:model-value="v => onPropUpdate('hAlign', v)"
        />
        <AlignButtons
          v-if="hasProp('vAlign')"
          label="V-Align"
          :model-value="String(selectedNode.node.props.vAlign || 'top')"
          :options="V_ALIGN_OPTIONS"
          @update:model-value="v => onPropUpdate('vAlign', v)"
        />
      </div>
      <div v-if="hasWidthGap" class="prop-pair">
        <PropRow
          :def="layoutDefs.find(d => d.key === 'width')!"
          :value="selectedNode.node.props.width ?? 0"
          :binding="selectedNode.node.bind?.width"
          @update="onPropUpdate"
          @update:binding="onBindingUpdate"
          @clear:binding="onBindingClear"
        />
        <PropRow
          :def="layoutDefs.find(d => d.key === 'gap')!"
          :value="selectedNode.node.props.gap ?? 0"
          :binding="selectedNode.node.bind?.gap"
          @update="onPropUpdate"
          @update:binding="onBindingUpdate"
          @clear:binding="onBindingClear"
        />
      </div>
      <PropRow
        v-for="def in layoutSingleDefs"
        :key="def.key"
        :def="def"
        :value="selectedNode.node.props[def.key] ?? (def.type === 'number' || def.type === 'range' ? 0 : '')"
        :binding="selectedNode.node.bind?.[def.key]"
        @update="onPropUpdate"
        @update:binding="onBindingUpdate"
        @clear:binding="onBindingClear"
      />

      <!-- 5. Appearance -->
      <ColorField
        v-if="hasFill"
        label="Fill"
        :model-value="String(selectedNode.node.props.fill || '')"
        :opacity="Number(selectedNode.node.props[opacityKey] ?? 1)"
        @update:model-value="v => onPropUpdate('fill', v)"
        @update:opacity="v => onPropUpdate(opacityKey, v)"
      />
      <ColorField
        v-if="hasGroup('stroke')"
        label="Stroke"
        :model-value="String(selectedNode.node.props.stroke || '')"
        :width="Number(selectedNode.node.props.strokeWidth || 0)"
        :width-min="0" :width-max="10" :width-step="0.5"
        @update:model-value="v => onPropUpdate('stroke', v)"
        @update:width="v => onPropUpdate('strokeWidth', v)"
      />
      <PropRow
        v-for="def in appearanceDefs"
        :key="def.key"
        :def="def"
        :value="selectedNode.node.props[def.key] ?? (def.type === 'number' || def.type === 'range' ? 0 : '')"
        :binding="selectedNode.node.bind?.[def.key]"
        @update="onPropUpdate"
        @update:binding="onBindingUpdate"
        @clear:binding="onBindingClear"
      />

      <!-- Safety net: ungrouped props -->
      <PropRow
        v-for="def in filteredPropDefs"
        :key="def.key"
        :def="def"
        :value="selectedNode.node.props[def.key] ?? (def.type === 'number' || def.type === 'range' ? 0 : '')"
        :binding="selectedNode.node.bind?.[def.key]"
        @update="onPropUpdate"
        @update:binding="onBindingUpdate"
        @clear:binding="onBindingClear"
      />

      <!-- 6. Box Model -->
      <BoxModelWidget
        v-if="hasBoxModel"
        :values="selectedNode.node.props"
        @update="onBoxModelUpdate"
      />

      <!-- Repeater: items binding -->
      <template v-if="selectedNode.node.type === 'repeater'">
        <div class="section-label">Items Binding</div>
        <div class="items-binding-row">
          <input
            type="text"
            class="items-binding-input"
            :value="selectedNode.node.bind?.items ?? ''"
            placeholder="e.g. attacks, cost"
            @change="onItemsBindingUpdate(($event.target as HTMLInputElement).value)"
          />
        </div>
      </template>

      <!-- Add child buttons (boxes and repeaters can have children) -->
      <template v-if="canAddChildren">
        <div class="section-label">Children ({{ selectedChildren.length }})</div>
        <div class="add-child-bar">
          <button @click="addChild('text')">+ Text</button>
          <button @click="addChild('text-wrap')">+ Wrap</button>
          <button @click="addChild('image-energy')">+ Energy</button>
          <button @click="addChild('image-logo')">+ Logo</button>
          <button @click="addChild('box')">+ Box</button>
          <button @click="addChild('repeater')">+ Repeater</button>
        </div>
      </template>

      <!-- Remove button (non-root only) -->
      <button v-if="!selectedNode.isRoot" class="remove-btn" @click="removeSelected">Remove</button>

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
.show-if-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.show-if-label { font-size: 10px; color: #888; text-transform: uppercase; flex-shrink: 0; }
.show-if-row .binding-badge { font-size: 10px; color: #4a9eff; background: rgba(74,158,255,0.12); padding: 1px 5px; border-radius: 3px; cursor: pointer; }
.show-if-row .binding-badge:hover { background: rgba(74,158,255,0.25); }
.show-if-none { font-size: 10px; color: #555; cursor: pointer; }
.show-if-none:hover { color: #888; }
.show-if-input { flex: 1; background: #0a1e3d; color: #4a9eff; border: 1px solid #4a9eff; border-radius: 3px; padding: 2px 6px; font-size: 11px; }
.items-binding-row { margin-bottom: 8px; }
.items-binding-input { width: 100%; background: #0a1e3d; color: #4a9eff; border: 1px solid #333; border-radius: 3px; padding: 4px 6px; font-size: 12px; box-sizing: border-box; }
.items-binding-input:focus { border-color: #4a9eff; outline: none; }
.align-pair { display: flex; gap: 4px; margin-bottom: 8px; }
.align-pair :deep(.align-buttons) { margin-bottom: 0; }
.prop-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.prop-pair :deep(.prop-row) { margin-bottom: 0; }

@media (max-width: 768px) {
  .add-child-bar button { padding: 6px 12px; font-size: 12px; }
  .remove-btn { padding: 6px 12px; font-size: 12px; }
  .key-hint { display: none; }
}
</style>
