<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { MAX_GENERATE_BATCH_NON_ADMIN } from "../../shared/constants/generate-limits.js";
import { canConfirmGenerate, needsTypedConfirm } from "./browse-generate-gating.js";

const props = defineProps<{
  open: boolean;
  /** Number of cards that will actually be queued (already clamped for non-admins). */
  effectiveCount: number;
  /** Unclamped count — used for the "X of Y" messaging when clamped. */
  actualCount: number;
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  confirm: [{ force: boolean }];
  cancel: [];
}>();

const force = ref(false);
const typedConfirm = ref("");

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    force.value = false;
    typedConfirm.value = "";
  }
});

const isClamped = computed(() => props.effectiveCount < props.actualCount);

const showTypedConfirm = computed(() =>
  needsTypedConfirm(props.isAdmin, props.effectiveCount),
);

const canConfirm = computed(() =>
  canConfirmGenerate({
    effectiveCount: props.effectiveCount,
    actualCount: props.actualCount,
    isAdmin: props.isAdmin,
    typedConfirm: typedConfirm.value,
  }),
);

function handleConfirm() {
  if (!canConfirm.value) return;
  emit("confirm", { force: force.value });
}
</script>

<template>
  <div v-if="open" class="dialog-overlay" @click.self="emit('cancel')">
    <div class="dialog browse-gen-dialog">
      <h3>Generate Proxies</h3>

      <p class="browse-gen-summary" data-testid="browse-gen-summary">
        <template v-if="isClamped">
          Generating the first <strong>{{ effectiveCount }}</strong> of
          <strong>{{ actualCount }}</strong> cards.
          <span class="browse-gen-note">Non-admin batch limit is {{ MAX_GENERATE_BATCH_NON_ADMIN }}.</span>
        </template>
        <template v-else>
          Generating <strong>{{ effectiveCount }}</strong> card{{ effectiveCount === 1 ? '' : 's' }}.
        </template>
      </p>

      <label class="browse-gen-force">
        <input type="checkbox" v-model="force" />
        Force regenerate (re-queue cards that already have generated artwork)
      </label>

      <div v-if="showTypedConfirm" class="browse-gen-confirm-typed">
        <label :for="`browse-gen-typed-${effectiveCount}`">
          To confirm a batch this large, type <strong>{{ effectiveCount }}</strong>:
        </label>
        <input
          :id="`browse-gen-typed-${effectiveCount}`"
          v-model="typedConfirm"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          data-testid="browse-gen-typed-input"
        />
      </div>

      <div class="dialog-actions">
        <button @click="emit('cancel')">Cancel</button>
        <button
          class="browse-gen-confirm-btn"
          :disabled="!canConfirm"
          data-testid="browse-gen-confirm"
          @click="handleConfirm"
        >
          Generate
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.browse-gen-dialog {
  width: 420px;
}

.browse-gen-summary {
  margin: 0 0 1rem;
  color: var(--color-text, #e0e0e0);
}

.browse-gen-note {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-muted, #9ca3af);
}

.browse-gen-force {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--color-text, #e0e0e0);
  cursor: pointer;
}

.browse-gen-confirm-typed {
  margin: 0 0 1rem;
  padding: 0.75rem;
  background: rgba(233, 69, 96, 0.08);
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 4px;
}

.browse-gen-confirm-typed label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text, #e0e0e0);
}

.browse-gen-confirm-typed input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  font-size: 1rem;
  background: var(--color-surface, #1a1a2e);
  border: 1px solid var(--color-border, #0f3460);
  border-radius: 4px;
  color: var(--color-text, #e0e0e0);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.browse-gen-confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
