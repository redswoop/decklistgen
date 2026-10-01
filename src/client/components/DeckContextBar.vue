<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useDecklist } from "../composables/useDecklist.js";
import { useDecks } from "../composables/useDecks.js";
import { useDeckSave } from "../composables/useDeckSave.js";
import { useAuth } from "../composables/useAuth.js";
import { useAuthDialog } from "../composables/useAuthDialog.js";
import { useToast } from "../composables/useToast.js";
import { ApiError } from "../lib/client.js";

const emit = defineEmits<{
  save: [];
  import: [];
  "go-to-gallery": [];
}>();

const {
  items, totalCards, countColor, DECK_SIZE,
  currentDeckId, currentDeckName, isDirty,
  renameDeck,
  undo, redo, canUndo, canRedo,
} = useDecklist();

const { updateDeck } = useDecks();
const { saving, saveCurrent } = useDeckSave();
const { isLoggedIn } = useAuth();
const { openAuthDialog } = useAuthDialog();

const renaming = ref(false);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

function startRename() {
  renameValue.value = currentDeckName.value || "";
  renaming.value = true;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

async function confirmRename() {
  const trimmed = renameValue.value.trim();
  renaming.value = false;
  if (!trimmed || !currentDeckId.value || trimmed === currentDeckName.value) return;
  const prev = currentDeckName.value;
  // Rename only — the cards' dirty state is untouched (a rename is not a save).
  renameDeck(trimmed); // optimistic; revert below if the server rejects
  try {
    await updateDeck({ id: currentDeckId.value, data: { name: trimmed } });
  } catch (e) {
    renameDeck(prev);
    const toast = useToast();
    if (e instanceof ApiError && e.isAuthError) {
      toast.error(e.status === 401 ? "Sign in to rename decks" : "Not authorized to rename decks");
    } else {
      toast.error("Failed to rename deck");
    }
    console.error("Rename failed:", e);
  }
}

// Save policy: a loaded deck saves in place whenever it's dirty (even to empty);
// an unsaved deck needs cards and a name (the dialog, via `save`).
const saveDisabledReason = computed(() => {
  if (!isLoggedIn.value) return "Sign in to save decks";
  if (saving.value) return "Saving…";
  if (currentDeckId.value) return isDirty.value ? "" : "No unsaved changes";
  return items.value.length === 0 ? "Add cards first" : "";
});

async function handleSave() {
  if (saveDisabledReason.value) return;
  if (currentDeckId.value) {
    await saveCurrent();
  } else {
    emit("save");
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
      <button class="dcb-btn dcb-gallery-btn" :disabled="!isLoggedIn" :title="!isLoggedIn ? 'Sign in to save and manage decks' : undefined" @click="isLoggedIn ? emit('go-to-gallery') : openAuthDialog()">Decks</button>

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
      <span v-if="isDirty" class="dcb-unsaved">Unsaved</span>
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
        :disabled="!!saveDisabledReason"
        :title="saveDisabledReason || (currentDeckId ? 'Save changes to this deck' : 'Save as a new deck')"
        @click="handleSave"
      >
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </div>
</template>
