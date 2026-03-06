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

const { addCard, toText } = useDecklist();

const showExport = ref(false);
const previewCard = ref<Card | null>(null);
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);

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
      @click="leftCollapsed = false"
    >&raquo;</button>
    <button
      v-if="rightCollapsed"
      class="expand-btn expand-btn-right"
      @click="rightCollapsed = false"
    >&laquo;</button>

    <Splitpanes>
      <Pane v-if="!leftCollapsed" :size="20" :min-size="15">
        <FilterSidebar @collapse="leftCollapsed = true" />
      </Pane>
      <Pane :min-size="30">
        <CardGrid @preview-card="handlePreview" />
      </Pane>
      <Pane v-if="!rightCollapsed" :size="25" :min-size="15">
        <DecklistPanel
          @collapse="rightCollapsed = true"
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
