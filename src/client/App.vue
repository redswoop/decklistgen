<script setup lang="ts">
import { ref } from "vue";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import FilterSidebar from "./components/FilterSidebar.vue";
import CardGrid from "./components/CardGrid.vue";
import DecklistPanel from "./components/DecklistPanel.vue";
import ExportDialog from "./components/ExportDialog.vue";
import CardLightbox from "./components/CardLightbox.vue";
import { useDecklist } from "./composables/useDecklist.js";
import type { Card } from "../shared/types/card.js";

const LAYOUT_KEY = "decklistgen-layout";

interface LayoutState {
  left: number;
  center: number;
  right: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

const defaults: LayoutState = { left: 15, center: 70, right: 15, leftCollapsed: false, rightCollapsed: false };

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

function saveLayout(partial: Partial<LayoutState>) {
  const current = loadLayout();
  Object.assign(current, partial);
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(current));
}

const saved = loadLayout();

const { addCard, toText } = useDecklist();

const showExport = ref(false);
const previewCard = ref<Card | null>(null);
const leftCollapsed = ref(saved.leftCollapsed);
const rightCollapsed = ref(saved.rightCollapsed);
const leftSize = ref(saved.left);
const centerSize = ref(saved.center);
const rightSize = ref(saved.right);

function onResized(panes: { size: number }[]) {
  if (!leftCollapsed.value && !rightCollapsed.value && panes.length === 3) {
    leftSize.value = panes[0].size;
    centerSize.value = panes[1].size;
    rightSize.value = panes[2].size;
    saveLayout({ left: panes[0].size, center: panes[1].size, right: panes[2].size });
  }
}

function collapseLeft() {
  leftCollapsed.value = true;
  saveLayout({ leftCollapsed: true });
}

function collapseRight() {
  rightCollapsed.value = true;
  saveLayout({ rightCollapsed: true });
}

function expandLeft() {
  leftCollapsed.value = false;
  saveLayout({ leftCollapsed: false });
}

function expandRight() {
  rightCollapsed.value = false;
  saveLayout({ rightCollapsed: false });
}

function handlePreview(card: Card) {
  previewCard.value = card;
}

function handleLightboxAdd(card: Card) {
  addCard(card);
  previewCard.value = null;
}
</script>

<template>
  <div class="app">
    <button
      v-if="leftCollapsed"
      class="expand-btn expand-btn-left"
      @click="expandLeft"
    >&raquo;</button>
    <button
      v-if="rightCollapsed"
      class="expand-btn expand-btn-right"
      @click="expandRight"
    >&laquo;</button>

    <Splitpanes @resized="onResized">
      <Pane v-if="!leftCollapsed" :size="leftSize" :min-size="10">
        <FilterSidebar @collapse="collapseLeft" />
      </Pane>
      <Pane :size="centerSize" :min-size="30">
        <CardGrid @preview-card="handlePreview" />
      </Pane>
      <Pane v-if="!rightCollapsed" :size="rightSize" :min-size="10">
        <DecklistPanel
          @collapse="collapseRight"
          @export="showExport = true"
        />
      </Pane>
    </Splitpanes>

    <ExportDialog
      v-if="showExport"
      :text="toText()"
      @close="showExport = false"
    />
    <CardLightbox
      v-if="previewCard"
      :card="previewCard"
      @close="previewCard = null"
      @add="handleLightboxAdd"
    />
  </div>
</template>
