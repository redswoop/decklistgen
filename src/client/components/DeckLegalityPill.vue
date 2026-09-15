<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import type { LegalityIssue } from "../../shared/utils/deck-legality.js";

const props = defineProps<{
  issues: LegalityIssue[];
  /** total cards in the deck; 0 renders the pill disabled */
  cardCount: number;
}>();

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const popoverPos = ref({ top: 0, left: 0 });

const errorCount = computed(() => props.issues.filter((i) => i.severity === "error").length);

const state = computed<"empty" | "legal" | "warning" | "error">(() => {
  if (props.cardCount === 0) return "empty";
  if (props.issues.length === 0) return "legal";
  return errorCount.value > 0 ? "error" : "warning";
});

const label = computed(() => {
  switch (state.value) {
    case "empty": return "Legality";
    case "legal": return "✓ Legal";
    default: {
      const n = props.issues.length;
      return `⚠ ${n} ${n === 1 ? "issue" : "issues"}`;
    }
  }
});

const tooltip = computed(() =>
  state.value === "empty"
    ? "Add cards to check deck legality"
    : "Deck legality — click for details",
);

function toggle() {
  if (state.value === "empty") return;
  open.value = !open.value;
  if (open.value) {
    nextTick(() => {
      if (triggerRef.value) {
        const rect = triggerRef.value.getBoundingClientRect();
        popoverPos.value = { top: rect.bottom + 6, left: rect.left };
      }
    });
  }
}

const popoverStyle = computed(() => ({
  position: "fixed" as const,
  top: popoverPos.value.top + "px",
  left: popoverPos.value.left + "px",
}));
</script>

<template>
  <div class="legality" @click.stop>
    <button
      ref="triggerRef"
      class="legality-pill"
      :class="`legality-pill-${state}`"
      :disabled="state === 'empty'"
      :title="tooltip"
      @click="toggle"
    >{{ label }}</button>
    <Teleport to="body">
      <div v-if="open" class="legality-backdrop" @click="open = false" />
      <div v-if="open" class="legality-popover" :style="popoverStyle">
        <div class="legality-popover-title">
          {{ state === "legal" ? "Deck is tournament legal" : "Deck legality" }}
        </div>
        <div v-if="state === 'legal'" class="legality-row">
          <span class="legality-dot legality-dot-legal" />
          <span>60 cards, all copy limits respected.</span>
        </div>
        <div v-for="issue in issues" :key="issue.rule + issue.message" class="legality-row">
          <span class="legality-dot" :class="`legality-dot-${issue.severity}`" />
          <span>{{ issue.message }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.legality {
  display: inline-flex;
}

.legality-pill {
  padding: 5px 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: #0f3460;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.legality-pill:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.legality-pill-legal {
  border-color: rgba(46, 160, 67, 0.6);
  color: #5cd675;
  background: rgba(46, 160, 67, 0.12);
}

.legality-pill-warning {
  border-color: rgba(210, 153, 34, 0.6);
  color: #e3b341;
  background: rgba(210, 153, 34, 0.12);
}

.legality-pill-error {
  border-color: rgba(233, 69, 96, 0.6);
  color: #f47186;
  background: rgba(233, 69, 96, 0.12);
}

.legality-pill-legal:hover:not(:disabled) { background: rgba(46, 160, 67, 0.22); }
.legality-pill-warning:hover:not(:disabled) { background: rgba(210, 153, 34, 0.22); }
.legality-pill-error:hover:not(:disabled) { background: rgba(233, 69, 96, 0.22); }
</style>

<style>
/* Teleported to body, so these can't be scoped */
.legality-backdrop {
  position: fixed;
  inset: 0;
  z-index: 998;
}

.legality-popover {
  z-index: 999;
  min-width: 260px;
  max-width: 360px;
  padding: 10px 12px;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  background: #16213e;
  color: #e0e0e0;
  font-size: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.legality-popover-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8b8ba7;
  margin-bottom: 8px;
}

.legality-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
  line-height: 1.4;
}

.legality-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transform: translateY(1px);
}

.legality-dot-legal { background: #2ea043; }
.legality-dot-warning { background: #d29922; }
.legality-dot-error { background: #e94560; }
</style>
