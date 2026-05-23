<script setup lang="ts">
/** Per-card detail panel. Replaces the modal lightbox in GalleryView.
 *
 *  Renders three tabs (Source / Cleaned / SVG), full card metadata, rendering
 *  metadata from `/api/pokeproxy/inspect/:cardId` (template + brightness), and
 *  the same action buttons the old lightbox had (Edit / Clean / Regen / Save
 *  prompt).
 */
import { ref, computed, watch } from "vue";
import { api } from "../../lib/client.js";
import { getSvg } from "../../composables/useGallerySvgCache.js";

interface GalleryCard {
  label: string;
  cardId: string;
  name: string;
  category: string;
  stage: string | null;
  hp: number | null;
  rarity: string | null;
  energyTypes: string[];
  effect: string | null;
  isFullArt: boolean;
  hasClean: boolean;
  hasComposite: boolean;
  hasSvg: boolean;
  hasSource: boolean;
  cleanMeta: Record<string, unknown> | null;
  promptRule: string | null;
  promptText: string | null;
  promptSkip: boolean;
}

interface InspectReport {
  cardId: string;
  template: string;
  textMode: "dark" | "light";
  textBrightness: number;
  hpTextMode: "dark" | "light" | null;
  hpBrightness: number | null;
  textModeOverridden?: boolean;
  hpTextModeOverridden?: boolean;
  textModeAverage?: "dark" | "light";
  textModeHistogram?: "dark" | "light";
  histogram?: {
    darkRatio: number;
    brightRatio: number;
    midRatio: number;
    meanLuminance: number;
  };
  hasSource: boolean;
  hasClean: boolean;
  hasComposite: boolean;
  hasSvg: boolean;
}

type ModeChoice = "auto" | "dark" | "light";

const props = defineProps<{
  card: GalleryCard;
  /** Width in px to render the card preview at. Matches the current
   *  gallery thumb-width so a selected card is 1:1 with the grid. */
  thumbWidth: number;
  svgCacheBust: number;
  imageCacheBust: number;
  busy: boolean;
  status: string;
  promptSaveStatus: string;
}>();

const emit = defineEmits<{
  close: [];
  edit: [cardId: string];
  clean: [force: boolean];
  regen: [];
  savePrompt: [text: string];
  /** Fired when a text-mode override changes. Parent should bump
   *  `svgCacheBust` so the rendered card picks up the new mode. */
  textModeChanged: [];
}>();

type Tab = "svg" | "source" | "clean";
const tab = ref<Tab>("svg");

const svgHtml = ref("");
const inspect = ref<InspectReport | null>(null);
const inspectLoading = ref(false);
const inspectError = ref("");
const textModeSaving = ref(false);
const textModeError = ref("");

const promptText = ref(props.card.promptText ?? "");

const textModeChoice = computed<ModeChoice>(() =>
  inspect.value?.textModeOverridden ? inspect.value.textMode : "auto",
);
const hpModeChoice = computed<ModeChoice>(() =>
  inspect.value?.hpTextModeOverridden ? (inspect.value.hpTextMode ?? "auto") : "auto",
);

watch(
  () => [props.card.cardId, props.svgCacheBust] as const,
  async ([cardId, bust]) => {
    svgHtml.value = "";
    const html = await getSvg(cardId, bust);
    if (props.card.cardId === cardId && props.svgCacheBust === bust) {
      svgHtml.value = html;
    }
  },
  { immediate: true },
);

watch(
  () => [props.card.cardId, props.svgCacheBust, props.imageCacheBust] as const,
  async ([cardId]) => {
    inspectLoading.value = true;
    inspectError.value = "";
    inspect.value = null;
    try {
      const report = await api.pokeproxyInspect(cardId);
      if (props.card.cardId === cardId) {
        inspect.value = report as InspectReport;
      }
    } catch (e) {
      inspectError.value = e instanceof Error ? e.message : String(e);
    } finally {
      inspectLoading.value = false;
    }
  },
  { immediate: true },
);

watch(() => props.card.cardId, () => {
  promptText.value = props.card.promptText ?? "";
});

const sourceUrl = computed(() => `/api/pokeproxy/image/${props.card.cardId}/source`);
const cleanUrl = computed(
  () => `/api/pokeproxy/image/${props.card.cardId}/composite?t=${props.imageCacheBust}`,
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

function brightnessPct(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v * 100)}%`;
}

async function setMode(field: "textMode" | "hpTextMode", choice: ModeChoice) {
  if (!inspect.value) return;
  // Don't fight a save by re-saving the current value.
  const currentChoice = field === "textMode" ? textModeChoice.value : hpModeChoice.value;
  if (currentChoice === choice) return;

  textModeSaving.value = true;
  textModeError.value = "";
  try {
    const value = choice === "auto" ? null : choice;
    await api.pokeproxySaveTextModeOverride(props.card.cardId, { [field]: value });
    // Force a re-render: bumping svgCacheBust is the parent's job, so emit.
    emit("textModeChanged");
  } catch (e) {
    textModeError.value = e instanceof Error ? e.message : String(e);
  } finally {
    textModeSaving.value = false;
  }
}
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
        :class="['inspector-tab', tab === 'svg' && 'inspector-tab-active']"
        @click="tab = 'svg'"
      >SVG</button>
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
        <div v-if="tab === 'svg'" class="inspector-svg" v-html="svgHtml || '<span class=inspector-placeholder>Loading SVG…</span>'" />
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

    <div class="inspector-section">
      <div class="inspector-section-title">Render data</div>
      <div v-if="inspectLoading" class="inspector-loading">Analyzing…</div>
      <div v-else-if="inspectError" class="inspector-error">Inspect failed: {{ inspectError }}</div>
      <dl v-else-if="inspect" class="inspector-kv">
        <dt>Template</dt><dd class="inspector-mono">{{ inspect.template }}</dd>
        <dt>Text mode</dt>
        <dd>
          <span :class="['inspector-mode', `inspector-mode-${inspect.textMode}`]">{{ inspect.textMode }}</span>
          <span class="inspector-mono inspector-faint"> · {{ brightnessPct(inspect.textBrightness) }}</span>
          <span v-if="inspect.textModeOverridden" class="inspector-warn" title="User override is in effect — auto-detection bypassed.">
            · forced
          </span>
          <div class="inspector-mode-toggle" role="radiogroup" aria-label="Text mode override">
            <button
              v-for="opt in (['auto', 'dark', 'light'] as ModeChoice[])"
              :key="opt"
              type="button"
              :class="['inspector-mode-btn', textModeChoice === opt && 'inspector-mode-btn-active']"
              :disabled="textModeSaving"
              :aria-pressed="textModeChoice === opt"
              :title="opt === 'auto' ? 'Use brightness auto-detection' : `Force ${opt} text`"
              @click="setMode('textMode', opt)"
            >{{ opt }}</button>
          </div>
        </dd>
        <template v-if="inspect.hpTextMode">
          <dt>HP text</dt>
          <dd>
            <span :class="['inspector-mode', `inspector-mode-${inspect.hpTextMode}`]">{{ inspect.hpTextMode }}</span>
            <span class="inspector-mono inspector-faint"> · {{ brightnessPct(inspect.hpBrightness) }}</span>
            <span v-if="inspect.hpTextModeOverridden" class="inspector-warn" title="User override is in effect for HP digits.">
              · forced
            </span>
            <span
              v-else-if="inspect.hpTextMode !== inspect.textMode"
              class="inspector-warn"
              title="Per-element HP brightness overrides the full-image mode for the HP digits only."
            > · diverges from text</span>
            <div class="inspector-mode-toggle" role="radiogroup" aria-label="HP text mode override">
              <button
                v-for="opt in (['auto', 'dark', 'light'] as ModeChoice[])"
                :key="opt"
                type="button"
                :class="['inspector-mode-btn', hpModeChoice === opt && 'inspector-mode-btn-active']"
                :disabled="textModeSaving"
                :aria-pressed="hpModeChoice === opt"
                :title="opt === 'auto' ? 'Use HP brightness auto-detection' : `Force ${opt} HP text`"
                @click="setMode('hpTextMode', opt)"
              >{{ opt }}</button>
            </div>
          </dd>
        </template>
        <template v-if="textModeError">
          <dt>Override</dt><dd class="inspector-error">{{ textModeError }}</dd>
        </template>
        <dt>Cached</dt>
        <dd>
          <span :class="['inspector-dot', inspect.hasSource && 'inspector-dot-on']" title="Source PNG"/>src
          <span :class="['inspector-dot', inspect.hasClean && 'inspector-dot-on']" title="Cleaned PNG"/>clean
          <span :class="['inspector-dot', inspect.hasComposite && 'inspector-dot-on']" title="Composite PNG"/>comp
        </dd>
      </dl>
    </div>

    <div v-if="inspect?.histogram" class="inspector-section">
      <div class="inspector-section-title">Brightness diagnostic</div>
      <dl class="inspector-kv">
        <dt title="Mean BT.709 luminance of the bottom 40%, vs 0.6 threshold.">
          Average
        </dt>
        <dd>
          <span :class="['inspector-mode', `inspector-mode-${inspect.textModeAverage}`]">
            {{ inspect.textModeAverage }}
          </span>
          <span class="inspector-mono inspector-faint">
            · {{ brightnessPct(inspect.textBrightness) }}
          </span>
        </dd>
        <dt title="Counts pixels in dark/bright/mid buckets; the bigger cluster wins. More robust to small logos over an otherwise-uniform background.">
          Histogram
        </dt>
        <dd>
          <span :class="['inspector-mode', `inspector-mode-${inspect.textModeHistogram}`]">
            {{ inspect.textModeHistogram }}
          </span>
          <span class="inspector-mono inspector-faint">
            · D{{ brightnessPct(inspect.histogram.darkRatio) }} /
            B{{ brightnessPct(inspect.histogram.brightRatio) }} /
            M{{ brightnessPct(inspect.histogram.midRatio) }}
          </span>
        </dd>
        <dt v-if="inspect.textModeAverage !== inspect.textModeHistogram">
          Detectors
        </dt>
        <dd v-if="inspect.textModeAverage !== inspect.textModeHistogram" class="inspector-warn">
          disagree — histogram chosen (more robust to mixed backgrounds)
        </dd>
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
        class="btn btn-edit"
        title="Open in template editor"
        @click="emit('edit', card.cardId)"
      >Edit template</button>
      <button
        class="btn btn-regen"
        :disabled="busy"
        :title="busy ? 'Operation in progress' : 'Re-render SVG with current settings'"
        @click="emit('regen')"
      >Regen SVG</button>
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
  min-width: 0;
  background: none;
  border: none;
  color: #aaa;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 8px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.inspector-tab:hover:not(:disabled) { color: #fff; }
.inspector-tab:disabled { opacity: 0.4; cursor: not-allowed; }
.inspector-tab-active { background: #2d2a14; color: #f39c12; }

.inspector-image {
  background: #0d1117;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.inspector-image-inner {
  max-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.inspector-image img {
  width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
}
.inspector-svg {
  width: 100%;
  border-radius: 6px;
}
.inspector-svg :deep(svg) {
  width: 100%;
  height: auto;
  display: block;
}
.inspector-placeholder { color: #555; font-size: 12px; }

.inspector-section {
  background: #181d2a;
  border-radius: 6px;
  padding: 10px 12px;
}
.inspector-section-title {
  font-size: 10px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.inspector-kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 12px;
  row-gap: 4px;
  margin: 0;
  font-size: 12px;
}
.inspector-kv dt { color: #888; }
.inspector-kv dd { margin: 0; color: #e0e0e0; word-break: break-word; }
.inspector-mono { font-family: monospace; }
.inspector-faint { color: #666; }

.inspector-mode {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.inspector-mode-dark  { background: #1a1a2e; color: #cbd5e0; border: 1px solid #4a5568; }
.inspector-mode-light { background: #faf089; color: #1a1a2e; }
.inspector-warn { color: #f6e05e; font-size: 11px; }

.inspector-mode-toggle {
  display: inline-flex;
  margin-top: 4px;
  gap: 0;
  background: #0d1117;
  border: 1px solid #2d3748;
  border-radius: 4px;
  overflow: hidden;
}
.inspector-mode-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  cursor: pointer;
}
.inspector-mode-btn + .inspector-mode-btn { border-left: 1px solid #2d3748; }
.inspector-mode-btn:hover:not(:disabled) { color: #e0e0e0; }
.inspector-mode-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.inspector-mode-btn-active { background: #2d2a14; color: #f39c12; }

.inspector-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #333;
  margin: 0 4px 0 8px;
  vertical-align: middle;
}
.inspector-dot:first-of-type { margin-left: 0; }
.inspector-dot-on { background: #9ae6b4; }

.inspector-loading,
.inspector-error { font-size: 11px; color: #888; }
.inspector-error { color: #fc8181; }

.inspector-status {
  font-size: 12px;
  color: #f39c12;
  padding: 4px 0;
}

.inspector-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.inspector-actions .btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 5px;
  border: none;
  cursor: pointer;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-edit { background: #2b6cb0; color: #bee3f8; }
.btn-clean { background: #276749; color: #9ae6b4; }
.btn-force { background: #9b2c2c; color: #fed7d7; }
.btn-regen { background: #553c9a; color: #d6bcfa; }
.btn-save-prompt { background: #f39c12; color: #000; }

.inspector-prompt {
  background: #181d2a;
  border-radius: 6px;
  padding: 8px 12px;
}
.inspector-prompt summary {
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.inspector-prompt-body {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.inspector-prompt textarea {
  width: 100%;
  background: #0d1117;
  border: 1px solid #333;
  color: #e0e0e0;
  border-radius: 4px;
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
</style>
