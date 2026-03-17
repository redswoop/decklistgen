<script setup lang="ts">
import { ref, computed } from "vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { useDecks } from "../composables/useDecks.js";
import { useDecklist } from "../composables/useDecklist.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { DeckSummary } from "../../shared/types/deck.js";

const emit = defineEmits<{
  "open-deck": [id: string];
  "new-deck": [];
  import: [];
}>();

const { decks, isLoading, fetchDeck, deleteDeck, copyDeck, updateDeck } = useDecks();
const { loadSavedDeck, isDirty, currentDeckId, clear } = useDecklist();

const search = ref("");
const menuOpenId = ref<string | null>(null);
const deleteTarget = ref<DeckSummary | null>(null);
const renamingId = ref<string | null>(null);
const renameValue = ref("");
const dirtyGuardTarget = ref<string | null>(null);
const dirtyGuardNewDeck = ref(false);

const filteredDecks = computed(() => {
  if (!search.value) return decks.value;
  const q = search.value.toLowerCase();
  return decks.value.filter((d) => d.name.toLowerCase().includes(q));
});

function coverUrl(deck: DeckSummary): string {
  return deck.coverImage ? cardImageUrl(deck.coverImage, "low") : "";
}

async function openDeck(id: string) {
  if (isDirty.value && currentDeckId.value !== id) {
    dirtyGuardTarget.value = id;
    return;
  }
  await doOpen(id);
}

async function doOpen(id: string) {
  dirtyGuardTarget.value = null;
  const deck = await fetchDeck(id);
  loadSavedDeck(deck);
  emit("open-deck", deck.id);
}

function confirmDirtySwitch() {
  if (dirtyGuardNewDeck.value) {
    dirtyGuardNewDeck.value = false;
    dirtyGuardTarget.value = null;
    clear();
    emit("new-deck");
    return;
  }
  if (dirtyGuardTarget.value) {
    doOpen(dirtyGuardTarget.value);
  }
}

function handleNewDeck() {
  if (isDirty.value) {
    dirtyGuardNewDeck.value = true;
    dirtyGuardTarget.value = "__new__";
    return;
  }
  clear();
  emit("new-deck");
}

function toggleMenu(id: string, e: Event) {
  e.stopPropagation();
  menuOpenId.value = menuOpenId.value === id ? null : id;
}

function startRename(deck: DeckSummary, e: Event) {
  e.stopPropagation();
  renamingId.value = deck.id;
  renameValue.value = deck.name;
  menuOpenId.value = null;
}

async function confirmRename(id: string) {
  if (renameValue.value.trim()) {
    await updateDeck({ id, data: { name: renameValue.value.trim() } });
  }
  renamingId.value = null;
}

async function handleCopy(deck: DeckSummary, e: Event) {
  e.stopPropagation();
  menuOpenId.value = null;
  await copyDeck({ id: deck.id });
}

function handleDelete(deck: DeckSummary, e: Event) {
  e.stopPropagation();
  menuOpenId.value = null;
  deleteTarget.value = deck;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  const id = deleteTarget.value.id;
  await deleteDeck(id);
  if (currentDeckId.value === id) {
    clear();
  }
  deleteTarget.value = null;
}
</script>

<template>
  <div class="deck-gallery">
    <div class="deck-gallery-header">
      <h2 class="deck-gallery-title">Your Decks</h2>
      <div class="deck-gallery-actions">
        <input
          v-model="search"
          type="text"
          class="deck-gallery-search"
          placeholder="Search decks..."
        />
        <button class="deck-gallery-btn" @click="handleNewDeck">New Deck</button>
        <button class="deck-gallery-btn deck-gallery-btn-secondary" @click="emit('import')">Import</button>
      </div>
    </div>

    <div v-if="isLoading" class="deck-gallery-loading">Loading decks...</div>

    <div v-else class="deck-gallery-grid">
      <!-- New deck card -->
      <div class="deck-gallery-card deck-gallery-card-new" @click="handleNewDeck">
        <div class="deck-gallery-card-art deck-gallery-card-new-art">
          <span class="deck-gallery-new-icon">+</span>
        </div>
        <div class="deck-gallery-card-footer">
          <div class="deck-gallery-card-name">New Deck</div>
        </div>
      </div>

      <!-- Deck cards -->
      <div
        v-for="deck in filteredDecks"
        :key="deck.id"
        :class="['deck-gallery-card', { 'deck-gallery-card-active': currentDeckId === deck.id }]"
        @click="openDeck(deck.id)"
      >
        <div class="deck-gallery-card-art">
          <img v-if="coverUrl(deck)" :src="coverUrl(deck)" />
          <div v-else class="deck-gallery-card-placeholder" />
          <span class="deck-gallery-card-count">{{ deck.cardCount }}/60</span>
        </div>
        <div v-if="renamingId === deck.id" class="deck-gallery-card-footer" @click.stop>
          <input
            v-model="renameValue"
            class="deck-gallery-rename-input"
            autofocus
            @keyup.enter="confirmRename(deck.id)"
            @keyup.escape="renamingId = null"
            @blur="confirmRename(deck.id)"
          />
        </div>
        <div v-else class="deck-gallery-card-footer">
          <div class="deck-gallery-card-name">{{ deck.name }}</div>
          <div class="deck-gallery-card-menu-wrap">
            <button class="deck-gallery-card-menu-btn" @click="toggleMenu(deck.id, $event)">&#x22EF;</button>
            <div v-if="menuOpenId === deck.id" class="deck-gallery-card-menu" @click.stop>
              <button @click="startRename(deck, $event)">Rename</button>
              <button @click="handleCopy(deck, $event)">Duplicate</button>
              <button class="deck-gallery-menu-danger" @click="handleDelete(deck, $event)">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-if="deleteTarget"
      title="Delete Deck"
      :message="`Delete &quot;${deleteTarget.name}&quot;? This cannot be undone.`"
      confirm-label="Delete"
      @confirm="confirmDelete"
      @close="deleteTarget = null"
    />

    <ConfirmDialog
      v-if="dirtyGuardTarget"
      title="Unsaved Changes"
      message="You have unsaved changes. Discard them?"
      confirm-label="Discard"
      :confirm-danger="false"
      @confirm="confirmDirtySwitch"
      @close="dirtyGuardTarget = null; dirtyGuardNewDeck = false"
    />
  </div>
</template>
