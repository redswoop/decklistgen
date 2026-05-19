<script setup lang="ts">
import type { TemplateName } from "../../composables/useGalleryCardSource.js";

export type PreviewMode = "editing" | "physical";
export type TemplateFilter = "all" | TemplateName;

const props = defineProps<{
  filteredCount: number;
  cardCount: number;
  previewMode: PreviewMode;
  editingThumbWidth: number;
  search: string;
  templateFilter: TemplateFilter;
  templateNames: readonly TemplateName[];
  templateCounts: Record<TemplateName, number>;
  bulkBusy: boolean;
  missingCount: number;
}>();

const emit = defineEmits<{
  "update:previewMode": [m: PreviewMode];
  "update:editingThumbWidth": [w: number];
  "update:search": [s: string];
  "update:templateFilter": [t: TemplateFilter];
  "generate-missing": [];
  "force-regenerate": [];
  print: [];
}>();
</script>

<template>
  <div>
    <div class="gallery-header">
      <h2>Gallery</h2>
      <span class="gallery-count">{{ filteredCount }} / {{ cardCount }}</span>

      <div class="fs-mode-seg" role="tablist" aria-label="Preview size mode">
        <button
          :class="['fs-mode-btn', previewMode === 'editing' && 'fs-mode-btn-active']"
          title="Standard thumbnail size for tweaking."
          @click="emit('update:previewMode', 'editing')"
        >Editing size</button>
        <button
          :class="['fs-mode-btn', previewMode === 'physical' && 'fs-mode-btn-active']"
          title="Render at true print dimensions (2.5″ × 3.5″) using your calibrated display DPI."
          @click="emit('update:previewMode', 'physical')"
        >Print size</button>
      </div>

      <input
        v-if="previewMode === 'editing'"
        type="range"
        class="gallery-zoom"
        min="120"
        max="320"
        step="10"
        :value="editingThumbWidth"
        title="Thumbnail size"
        @input="(e: Event) => emit('update:editingThumbWidth', Number((e.target as HTMLInputElement).value))"
      />

      <input
        :value="search"
        type="search"
        class="gallery-search"
        placeholder="Search…"
        title="Filter by name or card id"
        @input="(e: Event) => emit('update:search', (e.target as HTMLInputElement).value)"
      />

      <div class="gallery-bulk">
        <button
          class="btn btn-gen-missing"
          :disabled="bulkBusy || missingCount === 0"
          :title="missingCount === 0 ? 'Every card already has cleaned artwork' : `Queue ComfyUI clean for ${missingCount} card(s) lacking artwork`"
          @click="emit('generate-missing')"
        >Generate Missing ({{ missingCount }})</button>
        <button
          class="btn btn-force-all"
          :disabled="bulkBusy || cardCount === 0"
          title="Force-clean every gallery card — slow & GPU-heavy"
          @click="emit('force-regenerate')"
        >Force Regenerate All</button>
        <button
          class="btn btn-print"
          :disabled="cardCount === 0"
          title="Open print sheet in new tab"
          @click="emit('print')"
        >Print</button>
      </div>
    </div>

    <div class="gallery-chips">
      <button
        :class="['fs-chip', templateFilter === 'all' && 'fs-chip-active']"
        @click="emit('update:templateFilter', 'all')"
      >All</button>
      <button
        v-for="t in templateNames"
        :key="t"
        :class="['fs-chip', templateFilter === t && 'fs-chip-active']"
        :disabled="templateCounts[t] === 0"
        :title="`${templateCounts[t]} card(s) resolve to ${t}`"
        @click="emit('update:templateFilter', t)"
      >{{ t }} <span class="fs-chip-count">{{ templateCounts[t] }}</span></button>
    </div>
  </div>
</template>

<style scoped>
.gallery-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.gallery-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.gallery-count {
  font-size: 13px;
  color: #888;
}

.gallery-bulk {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.fs-mode-seg {
  display: inline-flex;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 14px;
  overflow: hidden;
}
.fs-mode-btn {
  background: none; border: none;
  color: #aaa; font-size: 12px; font-weight: 600;
  padding: 5px 14px;
  cursor: pointer;
}
.fs-mode-btn:hover { color: #fff; }
.fs-mode-btn-active { background: #2d2a14; color: #f39c12; }

.gallery-zoom {
  width: 110px;
  accent-color: #f39c12;
}

.gallery-search {
  background: #0d1117;
  color: #ddd;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  width: 140px;
}
.gallery-search:focus { outline: none; border-color: #f39c12; }

.gallery-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 0 12px 0;
}
.fs-chip {
  background: #1a1a2e;
  color: #aaa;
  border: 1px solid #333;
  border-radius: 14px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.fs-chip:hover:not(:disabled) { color: #fff; border-color: #555; }
.fs-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.fs-chip-active { background: #2d2a14; color: #f39c12; border-color: #f39c12; }
.fs-chip-count { font-size: 10px; color: #666; font-family: monospace; }
.fs-chip-active .fs-chip-count { color: #f39c12; }

.btn {
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-gen-missing { background: #276749; color: #9ae6b4; }
.btn-force-all   { background: #9b2c2c; color: #fed7d7; }
.btn-print { background: #2d3748; color: #a0aec0; }
</style>
