<script setup lang="ts">
import { computed } from "vue";
import { useAuth } from "../composables/useAuth.js";
import { clampForAdmin } from "./browse-generate-gating.js";

const props = defineProps<{
  selectedCount: number;
  visibleCount: number;
}>();

const emit = defineEmits<{
  click: [];
}>();

const { isLoggedIn, isAuthorized, isAdmin } = useAuth();

const actualCount = computed(() =>
  props.selectedCount > 0 ? props.selectedCount : props.visibleCount,
);

const effectiveCount = computed(() => clampForAdmin(isAdmin.value, actualCount.value));

const isClamped = computed(() => effectiveCount.value < actualCount.value);

const disabledReason = computed(() => {
  if (!isLoggedIn.value) return "Sign in to generate";
  if (!isAuthorized.value) return "Your account is not authorized to generate images";
  if (actualCount.value <= 0) return "Select cards or apply a filter";
  return null;
});

const label = computed(() => {
  if (actualCount.value <= 0) return "Generate";
  if (isClamped.value) return `Generate ${effectiveCount.value} of ${actualCount.value}`;
  return `Generate ${effectiveCount.value}`;
});

function handleClick() {
  if (disabledReason.value) return;
  emit("click");
}
</script>

<template>
  <button
    class="browse-gen-btn"
    :disabled="disabledReason !== null"
    :title="disabledReason ?? (selectedCount > 0 ? 'Generate selected cards' : 'Generate visible cards')"
    data-testid="browse-generate-btn"
    @click="handleClick"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.browse-gen-btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(233, 69, 96, 0.4);
  border-radius: 4px;
  background: rgba(233, 69, 96, 0.12);
  color: #e94560;
  cursor: pointer;
  white-space: nowrap;
}

.browse-gen-btn:hover:not(:disabled) {
  background: rgba(233, 69, 96, 0.22);
}

.browse-gen-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
