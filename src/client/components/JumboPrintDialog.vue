<script setup lang="ts">
/**
 * Jumbo print pair-picker. Opened from the lightbox's "Print Jumbo" button.
 * Card 1 is the card you're viewing; Card 2 is optional — search ANY card (not
 * just the deck) or pick a recent one. With two cards it prints 2-up landscape
 * (two jumbo cards fit side-by-side on Letter); with one it prints 1-up portrait.
 *
 * Each card carries its own version (Original / Cleaned / Proxy): card 1 starts
 * on whatever the lightbox was showing, card 2 defaults to the same and can be
 * changed independently. The chosen versions ride along to the print sheet as a
 * per-card `art` list.
 */
import { ref, computed, watch, onUnmounted } from "vue";
import type { Card } from "../../shared/types/card.js";
import { api } from "../lib/client.js";
import { usePokeproxyBatch, getCardImageUrl } from "../composables/usePokeproxy.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import CssCardRenderer from "./CssCardRenderer.vue";

type Version = "original" | "cleaned" | "proxy";

const VERSIONS: { value: Version; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "cleaned", label: "Cleaned" },
  { value: "proxy", label: "Proxy" },
];

const props = defineProps<{
  currentCard: Card;
  version: Version;
  /** Cards already in view (browse/deck list) offered as quick "recent" picks. */
  recentCards: Card[];
}>();

const emit = defineEmits<{ close: [] }>();

const secondCard = ref<Card | null>(null);
const layout = ref<"two-up" | "one-up">("one-up");

// Per-card print version. Card 1 inherits the lightbox's selection; card 2
// defaults to the same and is editable independently.
const version1 = ref<Version>(props.version);
const version2 = ref<Version>(props.version);

// Picking a second card implies you want them paired; clearing it falls back to
// the single-card portrait print. The user can still override the radio after.
watch(secondCard, (v) => {
  layout.value = v ? "two-up" : "one-up";
});

const query = ref("");
const results = ref<Card[]>([]);
const searching = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

// Recent quick-picks: the in-view cards minus the current one (and the chosen
// second card, so it doesn't appear twice). Capped to keep the dialog compact.
const recentPicks = computed(() =>
  props.recentCards
    .filter((c) => c.id !== props.currentCard.id && c.id !== secondCard.value?.id)
    .slice(0, 8),
);

// Batch-fetch pokeproxy status for every card whose preview we might render, so
// the Cleaned/Proxy previews resolve to real cleaned art instead of a fallback.
const statusIds = computed(() => {
  const ids = new Set<string>([props.currentCard.id]);
  if (secondCard.value) ids.add(secondCard.value.id);
  for (const c of results.value) ids.add(c.id);
  for (const c of recentPicks.value) ids.add(c.id);
  return [...ids];
});
usePokeproxyBatch(statusIds);

watch(query, (q) => {
  clearTimeout(searchTimer);
  const term = q.trim();
  if (term.length < 2) {
    results.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  searchTimer = setTimeout(async () => {
    try {
      const { cards } = await api.getCards({ nameSearch: term }, 1, 24);
      // Don't offer the current card back as its own pair.
      results.value = cards.filter((c) => c.id !== props.currentCard.id);
    } catch {
      results.value = [];
    } finally {
      searching.value = false;
    }
  }, 250);
});

onUnmounted(() => clearTimeout(searchTimer));

function pickSecond(card: Card) {
  secondCard.value = secondCard.value?.id === card.id ? null : card;
}

function clearSecond() {
  secondCard.value = null;
}

/**
 * Preview art for a slot at a given version:
 *   original — the untouched TCGdex scan,
 *   cleaned  — the cleaned PNG (no chrome); falls back to original if none,
 *   proxy    — handled by CssCardRenderer over the cleaned art (see template).
 */
function previewImg(card: Card, v: Version): string | null {
  if (v === "original") return cardImageUrl(card.imageBase, "low");
  return getCardImageUrl(card, "proxy", "low") ?? cardImageUrl(card.imageBase, "low");
}

function handlePrint() {
  const ids = [props.currentCard.id];
  const arts: Version[] = [version1.value];
  if (secondCard.value) {
    ids.push(secondCard.value.id);
    arts.push(version2.value);
  }
  const params = new URLSearchParams({
    cardId: ids.join(","),
    size: "jumbo",
    art: arts.join(","),
    auto: "1",
  });
  if (layout.value === "two-up") params.set("orientation", "landscape");
  window.open(`/print.html?${params.toString()}`, "_blank");
  emit("close");
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog jumbo-dialog" @click.stop>
      <h3>Print Jumbo</h3>
      <p class="jumbo-sub">
        Oversized promo size, 132 × 185 mm. Add a second card to print two
        side-by-side on one landscape sheet. Each card prints in its own version.
      </p>

      <div class="jumbo-slots">
        <div class="jumbo-slot">
          <div class="jumbo-slot-label">Card 1 <span>(current)</span></div>
          <div class="jumbo-preview">
            <div v-if="version1 === 'proxy'" class="jumbo-preview-css">
              <CssCardRenderer
                :card="currentCard"
                :art-url="previewImg(currentCard, 'proxy') ?? ''"
              />
            </div>
            <img v-else :src="previewImg(currentCard, version1) ?? ''" :alt="currentCard.name" />
          </div>
          <div class="jumbo-versions" role="group" aria-label="Card 1 version">
            <button
              v-for="opt in VERSIONS"
              :key="opt.value"
              type="button"
              class="jumbo-version-btn"
              :class="{ active: version1 === opt.value }"
              @click="version1 = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="jumbo-slot">
          <div class="jumbo-slot-label">
            Card 2 <span>(optional)</span>
            <button
              v-if="secondCard"
              class="jumbo-clear"
              type="button"
              @click="clearSecond"
            >Clear</button>
          </div>
          <template v-if="secondCard">
            <div class="jumbo-preview">
              <div v-if="version2 === 'proxy'" class="jumbo-preview-css">
                <CssCardRenderer
                  :card="secondCard"
                  :art-url="previewImg(secondCard, 'proxy') ?? ''"
                />
              </div>
              <img v-else :src="previewImg(secondCard, version2) ?? ''" :alt="secondCard.name" />
            </div>
            <div class="jumbo-versions" role="group" aria-label="Card 2 version">
              <button
                v-for="opt in VERSIONS"
                :key="opt.value"
                type="button"
                class="jumbo-version-btn"
                :class="{ active: version2 === opt.value }"
                @click="version2 = opt.value"
              >{{ opt.label }}</button>
            </div>
          </template>
          <div v-else class="jumbo-slot-empty">No second card</div>
        </div>
      </div>

      <template v-if="!secondCard">
        <div class="jumbo-section-label">Find a second card</div>
        <input
          v-model="query"
          type="text"
          class="jumbo-search"
          placeholder="Search any card by name…"
        />
        <div v-if="searching" class="jumbo-hint">Searching…</div>
        <div v-else-if="query.trim().length >= 2 && results.length === 0" class="jumbo-hint">
          No matches.
        </div>
        <div v-else-if="results.length" class="jumbo-pick-grid">
          <button
            v-for="c in results"
            :key="c.id"
            type="button"
            class="jumbo-pick"
            :title="c.name"
            @click="pickSecond(c)"
          >
            <img :src="cardImageUrl(c.imageBase, 'low') ?? ''" :alt="c.name" loading="lazy" />
          </button>
        </div>

        <template v-if="recentPicks.length">
          <div class="jumbo-section-label">Recent</div>
          <div class="jumbo-pick-grid">
            <button
              v-for="c in recentPicks"
              :key="c.id"
              type="button"
              class="jumbo-pick"
              :title="c.name"
              @click="pickSecond(c)"
            >
              <img :src="cardImageUrl(c.imageBase, 'low') ?? ''" :alt="c.name" loading="lazy" />
            </button>
          </div>
        </template>
      </template>

      <div class="jumbo-section-label">Layout</div>
      <div class="jumbo-radio-group">
        <label class="jumbo-radio">
          <input type="radio" v-model="layout" value="two-up" :disabled="!secondCard" />
          Two per page (landscape)
        </label>
        <label class="jumbo-radio">
          <input type="radio" v-model="layout" value="one-up" />
          One per page (portrait)
        </label>
      </div>

      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn-primary" @click="handlePrint">Print</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jumbo-dialog {
  width: min(560px, calc(100vw - 32px));
  max-width: min(560px, calc(100vw - 32px));
  /* The base .dialog has no height cap; this dialog (slots + search + recents +
     layout + actions) can exceed the viewport, so scroll within it to keep the
     Print button reachable. */
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  box-sizing: border-box;
}

.jumbo-sub {
  margin: 0 0 16px;
  font-size: 13px;
  opacity: 0.7;
}

.jumbo-slots {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.jumbo-slot {
  flex: 1;
  min-width: 0;
}

.jumbo-slot-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
.jumbo-slot-label span {
  font-weight: 400;
  opacity: 0.55;
}

.jumbo-clear {
  margin-left: auto;
  background: none;
  border: none;
  color: inherit;
  opacity: 0.7;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}
.jumbo-clear:hover { opacity: 1; }

/* Slot preview — a single fixed-ratio card image (or CSS proxy render). */
.jumbo-preview {
  aspect-ratio: 5 / 7;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);
}
.jumbo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.jumbo-preview-css {
  width: 100%;
  height: 100%;
}
.jumbo-preview-css :deep(.card) {
  width: 100%;
  height: 100%;
}

.jumbo-slot-empty {
  aspect-ratio: 5 / 7;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  font-size: 12px;
  opacity: 0.5;
}

/* Per-card version segmented control. */
.jumbo-versions {
  display: flex;
  margin-top: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 7px;
  overflow: hidden;
}
.jumbo-version-btn {
  flex: 1;
  padding: 5px 4px;
  background: rgba(255, 255, 255, 0.04);
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  color: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.jumbo-version-btn:first-child {
  border-left: none;
}
.jumbo-version-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.jumbo-version-btn.active {
  background: var(--accent, #4a8cff);
  color: #fff;
}

.jumbo-section-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
  margin: 16px 0 8px;
}

.jumbo-search {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  font-size: 14px;
  color: inherit;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  outline: none;
}
.jumbo-search::placeholder {
  color: inherit;
  opacity: 0.45;
}
.jumbo-search:focus {
  border-color: var(--accent, #4a8cff);
  background: rgba(0, 0, 0, 0.4);
}

.jumbo-hint {
  font-size: 13px;
  opacity: 0.6;
  margin-top: 8px;
}

.jumbo-pick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.jumbo-pick {
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  overflow: hidden;
  aspect-ratio: 5 / 7;
}
.jumbo-pick:hover {
  border-color: var(--accent, #4a8cff);
}
.jumbo-pick img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.jumbo-radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.jumbo-radio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.jumbo-radio input:disabled + * {
  opacity: 0.4;
}
</style>
