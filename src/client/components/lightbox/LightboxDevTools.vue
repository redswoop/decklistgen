<script setup lang="ts">
import { ref, watch } from "vue";
import type { Card } from "../../../shared/types/card.js";
import { api } from "../../lib/client.js";
import { cardImageUrl } from "../../../shared/utils/card-image-url.js";

const props = defineProps<{
  currentCard: Card;
  hasCleanedImage: boolean;
  cleanedImageUrl: string | null;
  svgUrl: string;
  svgLoading: boolean;
  svgError: boolean;
  generating: boolean;
  svgRegenerating: boolean;
}>();

defineEmits<{
  generate: [];
  regenerate: [];
  regenerateSvg: [];
}>();

const LS_KEY = "decklistgen-devtools-open";
const expanded = ref(localStorage.getItem(LS_KEY) === "true");

function toggle() {
  expanded.value = !expanded.value;
  localStorage.setItem(LS_KEY, String(expanded.value));
}

// Prompt state
const promptLoading = ref(false);
const promptRuleName = ref("");
const promptText = ref("");
const promptEdited = ref("");
const promptEditing = ref(false);
const promptSaving = ref(false);
const promptLastUsed = ref<{ prompt?: string; seed?: number; rule?: string } | null>(null);
const promptSkip = ref(false);

// TCGdex raw data
const tcgdexData = ref<Record<string, unknown> | null>(null);
const tcgdexLoading = ref(false);
const tcgdexExpanded = ref(false);

const tcgdexCopied = ref(false);

async function copyTcgdex() {
  if (!tcgdexData.value) return;
  await navigator.clipboard.writeText(JSON.stringify(tcgdexData.value, null, 2));
  tcgdexCopied.value = true;
  setTimeout(() => { tcgdexCopied.value = false; }, 1500);
}

async function loadTcgdex() {
  tcgdexLoading.value = true;
  try {
    tcgdexData.value = await api.getCardTcgdex(props.currentCard.id);
  } catch {
    tcgdexData.value = null;
  } finally {
    tcgdexLoading.value = false;
  }
}

function toggleTcgdex() {
  tcgdexExpanded.value = !tcgdexExpanded.value;
  if (tcgdexExpanded.value && !tcgdexData.value) loadTcgdex();
}

async function loadPrompt() {
  promptLoading.value = true;
  try {
    const data = await api.pokeproxyGetPrompt(props.currentCard.id);
    promptRuleName.value = data.ruleName;
    promptText.value = data.prompt ?? "";
    promptEdited.value = data.prompt ?? "";
    promptSkip.value = data.skip;
    promptLastUsed.value = data.lastUsed;
  } catch {
    promptRuleName.value = "error";
    promptText.value = "";
  } finally {
    promptLoading.value = false;
  }
}

// Reload prompt when card changes or dev tools expands
watch(() => props.currentCard.id, () => {
  promptEditing.value = false;
  if (expanded.value) loadPrompt();
  // Reset tcgdex when card changes
  tcgdexData.value = null;
  if (tcgdexExpanded.value) loadTcgdex();
});

watch(expanded, (val) => {
  if (val) loadPrompt();
});

// Initial load if already expanded
if (expanded.value) loadPrompt();

async function savePrompt() {
  promptSaving.value = true;
  try {
    await api.pokeproxySavePrompt(props.currentCard.id, promptEdited.value);
    promptText.value = promptEdited.value;
    promptRuleName.value = `card:${props.currentCard.id}`;
    promptEditing.value = false;
  } catch (e: any) {
    console.error("Failed to save prompt:", e);
  } finally {
    promptSaving.value = false;
  }
}

function cancelEdit() {
  promptEdited.value = promptText.value;
  promptEditing.value = false;
}
</script>

<template>
  <div class="dev-tools">
    <button class="dev-toggle" @click="toggle">
      {{ expanded ? '▾' : '▸' }} Dev Tools
    </button>

    <div v-if="expanded" class="dev-panel">
      <!-- Image comparison -->
      <div class="dev-images">
        <!-- Original -->
        <div class="dev-img-col">
          <div class="dev-label">Original</div>
          <img
            v-if="currentCard.imageBase"
            :src="cardImageUrl(currentCard.imageBase, 'high')"
            :alt="currentCard.name"
            class="dev-img"
          />
          <div v-else class="dev-placeholder">No image</div>
        </div>

        <!-- Cleaned -->
        <div v-if="currentCard.isFullArt" class="dev-img-col">
          <div class="dev-label">Cleaned</div>
          <div v-if="generating" class="dev-placeholder dev-generating">
            <div class="generate-spinner small"></div>
            <div class="dev-gen-text">Generating...</div>
          </div>
          <img
            v-else-if="hasCleanedImage && cleanedImageUrl"
            :src="cleanedImageUrl"
            :alt="`${currentCard.name} (cleaned)`"
            class="dev-img dev-img-clickable"
            title="Click to regenerate"
            @click="$emit('regenerate')"
          />
          <div v-else class="dev-placeholder dev-clickable" @click="$emit('generate')">
            <div class="dev-gen-text">+ Generate</div>
          </div>
        </div>

        <!-- SVG Proxy -->
        <div class="dev-img-col">
          <div class="dev-label">SVG Proxy</div>
          <div v-if="(svgLoading || svgRegenerating) && !svgError" class="dev-placeholder">
            <div class="generate-spinner small"></div>
          </div>
          <div v-else-if="svgError" class="dev-placeholder dev-clickable" @click="$emit('regenerateSvg')">
            <div class="dev-gen-text">SVG Failed - Retry</div>
          </div>
          <img
            v-else
            :src="svgUrl"
            :alt="`${currentCard.name} (SVG)`"
            class="dev-img dev-img-clickable"
            title="Click to regenerate SVG"
            @click="$emit('regenerateSvg')"
          />
        </div>
      </div>

      <!-- Cleaner Prompt -->
      <div class="dev-prompt">
        <div class="dev-prompt-header">
          <div class="dev-label">Cleaner Prompt</div>
          <span v-if="promptRuleName" class="dev-rule-name">{{ promptRuleName }}</span>
        </div>

        <div v-if="promptLoading" class="dev-prompt-loading">Loading...</div>
        <div v-else-if="promptSkip" class="dev-prompt-skip">Skipped (no cleaning for this card type)</div>
        <div v-else>
          <!-- View / Edit -->
          <div v-if="!promptEditing" class="dev-prompt-view">
            <pre class="dev-prompt-text">{{ promptText || '(no prompt)' }}</pre>
            <button class="dev-prompt-btn" @click="promptEditing = true">Edit</button>
          </div>
          <div v-else class="dev-prompt-edit">
            <textarea
              v-model="promptEdited"
              class="dev-prompt-textarea"
              rows="4"
              placeholder="Enter cleaning prompt..."
            ></textarea>
            <div class="dev-prompt-actions">
              <button class="dev-prompt-btn dev-prompt-save" :disabled="promptSaving" @click="savePrompt">
                {{ promptSaving ? 'Saving...' : 'Save' }}
              </button>
              <button class="dev-prompt-btn" @click="cancelEdit">Cancel</button>
            </div>
          </div>

          <!-- Last used info -->
          <div v-if="promptLastUsed" class="dev-last-used">
            <span class="dev-last-label">Last gen:</span>
            rule={{ promptLastUsed.rule }}
            <template v-if="promptLastUsed.seed !== undefined">, seed={{ promptLastUsed.seed }}</template>
          </div>
        </div>
      </div>

      <!-- TCGdex Raw Data -->
      <div class="dev-tcgdex">
        <div class="dev-tcgdex-header">
          <button class="dev-tcgdex-toggle" @click="toggleTcgdex">
            {{ tcgdexExpanded ? '▾' : '▸' }} TCGdex Data
          </button>
          <button
            v-if="tcgdexExpanded && tcgdexData"
            class="dev-prompt-btn"
            @click="copyTcgdex"
          >
            {{ tcgdexCopied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <div v-if="tcgdexExpanded" class="dev-tcgdex-content">
          <div v-if="tcgdexLoading" class="dev-prompt-loading">Loading...</div>
          <div v-else-if="!tcgdexData" class="dev-prompt-loading">No data available</div>
          <pre v-else class="dev-tcgdex-json">{{ JSON.stringify(tcgdexData, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dev-tools {
  margin-top: 16px;
  border-top: 1px solid #0f3460;
  padding-top: 8px;
}

.dev-toggle {
  background: none;
  border: none;
  color: #7f8fa6;
  font-size: 11px;
  cursor: pointer;
  padding: 4px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dev-toggle:hover {
  color: #e0e0e0;
}

.dev-panel {
  margin-top: 8px;
}

.dev-images {
  display: flex;
  gap: 8px;
}

.dev-img-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dev-label {
  font-size: 10px;
  font-weight: 600;
  color: #7f8fa6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dev-img {
  width: 100%;
  max-width: 140px;
  border-radius: 6px;
}

.dev-img-clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}

.dev-img-clickable:hover {
  opacity: 0.8;
}

.dev-placeholder {
  width: 100%;
  max-width: 140px;
  aspect-ratio: 5/7;
  background: #0f3460;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.dev-clickable {
  cursor: pointer;
  border: 1px dashed #7f8fa6;
}

.dev-clickable:hover {
  border-color: #e94560;
}

.dev-generating {
  border: 1px solid #e94560;
}

.dev-gen-text {
  font-size: 10px;
  color: #7f8fa6;
}

.generate-spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

/* Prompt section */
.dev-prompt {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(15, 52, 96, 0.4);
}

.dev-prompt-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.dev-rule-name {
  font-size: 10px;
  color: #e94560;
  background: rgba(233, 69, 96, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: "SF Mono", "Fira Code", monospace;
}

.dev-prompt-loading,
.dev-prompt-skip {
  font-size: 11px;
  color: #7f8fa6;
  font-style: italic;
}

.dev-prompt-view {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.dev-prompt-text {
  flex: 1;
  font-size: 11px;
  color: #b0b0b0;
  line-height: 1.4;
  background: rgba(15, 52, 96, 0.3);
  padding: 6px 8px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "SF Mono", "Fira Code", monospace;
  margin: 0;
}

.dev-prompt-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: #0f3460;
  color: #e0e0e0;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.dev-prompt-btn:hover {
  background: #1a4a8a;
}

.dev-prompt-save {
  background: #e94560;
  color: white;
}

.dev-prompt-save:hover {
  background: #c23152;
}

.dev-prompt-save:disabled {
  opacity: 0.5;
  cursor: default;
}

.dev-prompt-edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dev-prompt-textarea {
  width: 100%;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 11px;
  padding: 6px 8px;
  resize: vertical;
  line-height: 1.4;
}

.dev-prompt-textarea:focus {
  outline: none;
  border-color: #e94560;
}

.dev-prompt-actions {
  display: flex;
  gap: 6px;
}

.dev-last-used {
  margin-top: 6px;
  font-size: 10px;
  color: #7f8fa6;
  font-family: "SF Mono", "Fira Code", monospace;
}

.dev-last-label {
  color: #555;
}

/* TCGdex raw data */
.dev-tcgdex {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(15, 52, 96, 0.4);
}

.dev-tcgdex-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dev-tcgdex-toggle {
  background: none;
  border: none;
  color: #7f8fa6;
  font-size: 10px;
  cursor: pointer;
  padding: 2px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dev-tcgdex-toggle:hover {
  color: #e0e0e0;
}

.dev-tcgdex-content {
  margin-top: 6px;
}

.dev-tcgdex-json {
  font-size: 12px;
  color: #b0b0b0;
  line-height: 1.5;
  background: rgba(15, 52, 96, 0.3);
  padding: 10px 12px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "SF Mono", "Fira Code", monospace;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}
</style>
