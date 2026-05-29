<script setup lang="ts">
/** Per-card detail panel. Replaces the modal lightbox in GalleryView.
 *
 *  Tabs: Proxy (CSS render) / Source / Cleaned. Card metadata, pipeline notes,
 *  action buttons (Clean / Re-clean / Save prompt).
 */
import { ref, computed, watch } from "vue";
import { api } from "../../lib/client.js";
import CssCardRenderer from "../CssCardRenderer.vue";
import { useCardDetail } from "../../composables/useCardDetail.js";
import type { GalleryCard } from "../../composables/useGalleryCardSource.js";

const props = defineProps<{
  card: GalleryCard;
  /** Width in px to render the card preview at. Matches the current
   *  gallery thumb-width so a selected card is 1:1 with the grid. */
  thumbWidth: number;
  imageCacheBust: number;
  busy: boolean;
  status: string;
  promptSaveStatus: string;
}>();

const emit = defineEmits<{
  close: [];
  clean: [force: boolean];
  savePrompt: [text: string];
}>();

type Tab = "proxy" | "source" | "clean";
const tab = ref<Tab>("proxy");

const promptText = ref(props.card.promptText ?? "");

watch(() => props.card.cardId, () => {
  promptText.value = props.card.promptText ?? "";
});

const cardIdRef = computed(() => props.card.cardId);
const detailEnabled = ref(true);
const { data: cardDetail } = useCardDetail(cardIdRef, detailEnabled);

const sourceUrl = computed(() => `/api/pokeproxy/image/${props.card.cardId}/source`);
const cleanUrl = computed(
  () => `/api/pokeproxy/image/${props.card.cardId}/composite?t=${props.imageCacheBust}`,
);
const proxyArtUrl = computed(() =>
  props.card.hasComposite || props.card.hasClean ? cleanUrl.value : "",
);

const cleanedLabel = computed(() => (props.card.isFullArt ? "Cleaned" : "Expanded"));
const cleanedAvailable = computed(() => props.card.hasComposite || props.card.hasClean);

const metaLine = computed(() =>
  [
    props.card.category,
    props.card.stage,
    props.card.hp ? `HP ${props.card.hp}` : null,
    props.card.energyTypes?.length ? props.card.energyTypes.join(", ") : null,
    props.card.rarity,
  ]
    .filter(Boolean)
    .join(" · "),
);
</script>

<template>
  <aside class="inspector">
    <div class="inspector-head">
      <div class="inspector-title">
        <div class="inspector-label">{{ card.label }}</div>
        <div class="inspector-name">{{ card.name }}</div>
      </div>
      <button class="inspector-close" title="Deselect" @click="emit('close')">&times;</button>
    </div>

    <div class="inspector-sub">{{ card.cardId }} · {{ metaLine }}</div>

    <div class="inspector-tabs" role="tablist">
      <button
        :class="['inspector-tab', tab === 'proxy' && 'inspector-tab-active']"
        :disabled="!card.card"
        :title="card.card ? '' : 'Card data not loaded yet'"
        @click="tab = 'proxy'"
      >Proxy</button>
      <button
        :class="['inspector-tab', tab === 'source' && 'inspector-tab-active']"
        :disabled="!card.hasSource"
        :title="card.hasSource ? '' : 'No source image cached yet'"
        @click="tab = 'source'"
      >Source</button>
      <button
        :class="['inspector-tab', tab === 'clean' && 'inspector-tab-active']"
        :disabled="!cleanedAvailable"
        :title="cleanedAvailable ? '' : 'No cleaned art — run Clean to generate'"
        @click="tab = 'clean'"
      >{{ cleanedLabel }}</button>
    </div>

    <div class="inspector-image">
      <div
        class="inspector-image-inner"
        :style="{ width: `${thumbWidth}px` }"
      >
        <CssCardRenderer
          v-if="tab === 'proxy' && card.card"
          :card="card.card"
          :detail="cardDetail"
          :art-url="proxyArtUrl"
        />
        <img v-else-if="tab === 'source'" :src="sourceUrl" :alt="card.name" />
        <img v-else-if="tab === 'clean' && cleanedAvailable" :src="cleanUrl" :alt="card.name" />
      </div>
    </div>

    <div class="inspector-section">
      <div class="inspector-section-title">Card data</div>
      <dl class="inspector-kv">
        <dt>Category</dt><dd>{{ card.category }}</dd>
        <dt v-if="card.stage">Stage</dt><dd v-if="card.stage">{{ card.stage }}</dd>
        <dt v-if="card.hp">HP</dt><dd v-if="card.hp">{{ card.hp }}</dd>
        <dt v-if="card.energyTypes?.length">Types</dt>
        <dd v-if="card.energyTypes?.length">{{ card.energyTypes.join(", ") }}</dd>
        <dt v-if="card.rarity">Rarity</dt><dd v-if="card.rarity">{{ card.rarity }}</dd>
        <dt>Full art</dt><dd>{{ card.isFullArt ? "yes" : "no" }}</dd>
      </dl>
    </div>

    <div v-if="card.promptRule || card.cleanMeta" class="inspector-section">
      <div class="inspector-section-title">Pipeline</div>
      <dl class="inspector-kv">
        <dt v-if="card.promptRule">Prompt rule</dt>
        <dd v-if="card.promptRule" class="inspector-mono">{{ card.promptRule }}</dd>
        <template v-if="card.cleanMeta">
          <dt>Last clean</dt>
          <dd class="inspector-mono">
            {{ card.cleanMeta.rule }} · seed {{ card.cleanMeta.seed }}<br/>
            <span class="inspector-faint">{{ card.cleanMeta.timestamp }}</span>
          </dd>
        </template>
      </dl>
    </div>

    <div v-if="status" class="inspector-status">{{ status }}</div>

    <div class="inspector-actions">
      <button
        class="btn btn-clean"
        :disabled="busy"
        :title="busy ? 'Operation in progress' : ''"
        @click="emit('clean', false)"
      >{{ card.isFullArt ? "Clean" : "Expand" }}</button>
      <button
        class="btn btn-force"
        :disabled="busy"
        :title="busy ? 'Operation in progress' : 'Re-run ComfyUI from scratch'"
        @click="emit('clean', true)"
      >{{ card.isFullArt ? "Re-clean" : "Re-expand" }}</button>
    </div>

    <details class="inspector-prompt">
      <summary>Prompt</summary>
      <div class="inspector-prompt-body">
        <textarea v-model="promptText" rows="4" />
        <div class="inspector-prompt-actions">
          <button class="btn btn-save-prompt" @click="emit('savePrompt', promptText)">Save for this card</button>
          <span v-if="promptSaveStatus" class="inspector-faint">{{ promptSaveStatus }}</span>
        </div>
      </div>
    </details>
  </aside>
</template>

<style scoped>
.inspector {
  background: #131826;
  border-left: 1px solid #2a2a40;
  padding: 16px 18px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.inspector-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.inspector-title { min-width: 0; }
.inspector-label {
  font-size: 11px;
  font-weight: 700;
  color: #f39c12;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.inspector-name {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}
.inspector-close {
  background: none; border: none; color: #888;
  font-size: 22px; cursor: pointer; line-height: 1; padding: 0 6px;
}
.inspector-close:hover { color: #fff; }

.inspector-sub {
  font-size: 11px;
  color: #888;
  font-family: monospace;
  margin-top: -8px;
}

.inspector-tabs {
  display: flex;
  gap: 0;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
}

.inspector-tab {
  flex: 1;
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.inspector-tab:hover:not(:disabled) { color: #fff; }
.inspector-tab:disabled { opacity: 0.4; cursor: not-allowed; }
.inspector-tab-active { background: #2d2a14; color: #f39c12; }

.inspector-image {
  display: flex;
  justify-content: center;
}
.inspector-image-inner {
  border-radius: 6px;
  overflow: hidden;
  background: #0d0f1c;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
}
.inspector-image-inner > img {
  width: 100%;
  height: auto;
  display: block;
}
.inspector-image-inner :deep(.css-card-renderer) {
  width: 100%;
}
.inspector-placeholder {
  color: #555;
  font-size: 12px;
  padding: 32px;
}

.inspector-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.inspector-section-title {
  font-size: 11px;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inspector-kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0;
  font-size: 12px;
}
.inspector-kv dt {
  color: #888;
  font-weight: 600;
}
.inspector-kv dd {
  margin: 0;
  color: #ddd;
  word-break: break-word;
}
.inspector-mono { font-family: monospace; }
.inspector-faint { color: #666; }

.inspector-status {
  font-size: 12px;
  color: #ccc;
  padding: 6px 10px;
  background: #1a1a2e;
  border-radius: 4px;
}

.inspector-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.inspector-actions .btn {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: #ddd;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.inspector-actions .btn:hover:not(:disabled) {
  background: #2a2a3a;
  color: #fff;
}
.inspector-actions .btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.inspector-prompt {
  border-top: 1px solid #2a2a40;
  padding-top: 8px;
}
.inspector-prompt summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #aaa;
}
.inspector-prompt summary:hover { color: #fff; }
.inspector-prompt-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.inspector-prompt-body textarea {
  width: 100%;
  background: #0d0f1c;
  border: 1px solid #333;
  border-radius: 4px;
  color: #ddd;
  padding: 6px 8px;
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
  box-sizing: border-box;
}
.inspector-prompt-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-save-prompt {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: #ddd;
  cursor: pointer;
}
.btn-save-prompt:hover { background: #2a2a3a; color: #fff; }
</style>
