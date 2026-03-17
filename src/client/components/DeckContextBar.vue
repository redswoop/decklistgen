<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useDecklist } from "../composables/useDecklist.js";
import { useDecks } from "../composables/useDecks.js";
import { useToast } from "../composables/useToast.js";
import { ApiError } from "../lib/client.js";

const emit = defineEmits<{
  save: [];
  "save-update": [];
  import: [];
  "go-to-gallery": [];
}>();

const {
  items, totalCards, countColor, DECK_SIZE,
  currentDeckId, currentDeckName, isDirty,
  toDeckCards, markSaved,
  importSource, importedAt,
  undo, redo, canUndo, canRedo,
} = useDecklist();

const { createDeck, updateDeck } = useDecks();

const renaming = ref(false);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
const saving = ref(false);

function startRename() {
  renameValue.value = currentDeckName.value || "";
  renaming.value = true;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function confirmRename() {
  const trimmed = renameValue.value.trim();
  if (trimmed && currentDeckId.value) {
    updateDeck({ id: currentDeckId.value, data: { name: trimmed } });
    markSaved(currentDeckId.value, trimmed);
  }
  renaming.value = false;
}

async function handleSave() {
  if (items.value.length === 0) return;
  saving.value = true;
  try {
    if (currentDeckId.value && isDirty.value) {
      await updateDeck({
        id: currentDeckId.value,
        data: {
          name: currentDeckName.value,
          cards: toDeckCards(),
        },
      });
      markSaved(currentDeckId.value, currentDeckName.value);
    } else if (!currentDeckId.value) {
      emit("save");
      saving.value = false;
      return;
    }
  } catch (e) {
    const toast = useToast();
    if (e instanceof ApiError && e.isAuthError) {
      toast.error(e.status === 401 ? "Sign in to save decks" : "Not authorized to save decks");
    } else {
      toast.error("Failed to save deck");
    }
    console.error("Save failed:", e);
  } finally {
    saving.value = false;
  }
}

const displayName = () => {
  if (items.value.length === 0 && !currentDeckId.value) return "New Deck";
  return currentDeckName.value || "Untitled Deck";
};
</script>

<template>
  <div class="deck-context-bar">
    <div class="dcb-left">
      <button class="dcb-btn dcb-gallery-btn" @click="emit('go-to-gallery')">Decks</button>

      <!-- Deck name (click to rename) -->
      <span v-if="renaming" class="dcb-name-edit">
        <input
          ref="renameInput"
          v-model="renameValue"
          class="dcb-rename-input"
          @keyup.enter="confirmRename"
          @keyup.escape="renaming = false"
          @blur="confirmRename"
        />
      </span>
      <button
        v-else
        class="dcb-name"
        :title="currentDeckId ? 'Click to rename' : ''"
        :disabled="!currentDeckId"
        @click="startRename"
      >
        {{ displayName() }}
      </button>

      <!-- Card count badge -->
      <span class="dcb-count" :style="{ color: countColor }">
        {{ totalCards }}/{{ DECK_SIZE }}
      </span>

      <!-- Unsaved indicator -->
      <span v-if="isDirty && currentDeckId" class="dcb-unsaved">Unsaved</span>
    </div>

    <div class="dcb-right">
      <!-- Undo / Redo -->
      <button class="dcb-btn dcb-undo-btn" :disabled="!canUndo"
        :title="canUndo ? 'Undo (Ctrl+Z)' : 'Nothing to undo'"
        @click="undo">&#x21A9;</button>
      <button class="dcb-btn dcb-redo-btn" :disabled="!canRedo"
        :title="canRedo ? 'Redo (Ctrl+Shift+Z)' : 'Nothing to redo'"
        @click="redo">&#x21AA;</button>

      <!-- Save button -->
      <button
        class="dcb-btn dcb-save-btn"
        :disabled="saving || items.length === 0 || (currentDeckId != null && !isDirty)"
        :title="currentDeckId && !isDirty ? 'No unsaved changes' : (items.length === 0 ? 'Add cards first' : '')"
        @click="handleSave"
      >
        {{ saving ? 'Saving...' : (currentDeckId && isDirty ? 'Save' : 'Save As...') }}
      </button>
    </div>
  </div>
</template>
