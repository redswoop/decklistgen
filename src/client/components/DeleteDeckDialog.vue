<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from "vue";

const props = defineProps<{
  deckName: string;
}>();

const emit = defineEmits<{
  confirm: [];
  close: [];
}>();

const typed = ref("");
const input = ref<HTMLInputElement | null>(null);

const canConfirm = computed(() => typed.value.trim() === props.deckName);

onMounted(() => {
  nextTick(() => input.value?.focus());
});

function handleConfirm() {
  if (!canConfirm.value) return;
  emit("confirm");
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog delete-deck-dialog">
      <h3>Delete Deck</h3>
      <p class="confirm-dialog-message">
        This will permanently delete <strong>{{ deckName }}</strong>. This cannot be undone.
      </p>
      <p class="confirm-dialog-message delete-deck-dialog-instruction">
        Type the deck name to confirm:
      </p>
      <input
        ref="input"
        v-model="typed"
        type="text"
        class="delete-deck-dialog-input"
        :placeholder="deckName"
        @keyup.enter="handleConfirm"
        @keyup.escape="emit('close')"
      />
      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button
          class="btn-danger"
          :disabled="!canConfirm"
          :title="canConfirm ? 'Delete this deck' : 'Type the deck name exactly to enable'"
          @click="handleConfirm"
        >
          Delete Deck
        </button>
      </div>
    </div>
  </div>
</template>
