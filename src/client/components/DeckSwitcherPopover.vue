<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { useDecks } from "../composables/useDecks.js";
import { useDecklist } from "../composables/useDecklist.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { DeckSummary } from "../../shared/types/deck.js";

const emit = defineEmits<{
  close: [];
  import: [];
  "navigate-to-deck": [];
}>();

const { decks, isLoading, fetchDeck, deleteDeck, copyDeck, updateDeck } = useDecks();
const { loadSavedDeck, isDirty, currentDeckId, clear } = useDecklist();

const search = ref("");
const renamingId = ref<string | null>(null);
const renameValue = ref("");
const menuOpenId = ref<string | null>(null);
const deleteTarget = ref<DeckSummary | null>(null);
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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function switchToDeck(id: string) {
  if (isDirty.value && currentDeckId.value !== id) {
    dirtyGuardTarget.value = id;
    return;
  }
  await doSwitch(id);
}

async function doSwitch(id: string) {
  dirtyGuardTarget.value = null;
  const deck = await fetchDeck(id);
  loadSavedDeck(deck);
  emit("navigate-to-deck");
}

function confirmDirtySwitch() {
  if (dirtyGuardNewDeck.value) {
    dirtyGuardNewDeck.value = false;
    dirtyGuardTarget.value = null;
    clear();
    emit("navigate-to-deck");
    return;
  }
  if (dirtyGuardTarget.value) {
    doSwitch(dirtyGuardTarget.value);
  }
}

function handleNewDeck() {
  if (isDirty.value) {
    dirtyGuardNewDeck.value = true;
    dirtyGuardTarget.value = "__new__";
    return;
  }
  clear();
  emit("navigate-to-deck");
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
  // If we deleted the currently loaded deck, clear working deck
  if (currentDeckId.value === id) {
    clear();
  }
  deleteTarget.value = null;
}

// Close on click outside
function handleClickOutside(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest(".dsp-popover, .dcb-switcher-btn");
  if (!el) emit("close");
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});
</script>

<template>
  <div class="dsp-popover">
    <div class="dsp-header">
      <input
        v-model="search"
        type="text"
        class="dsp-search"
        placeholder="Search decks..."
      />
      <div class="dsp-header-actions">
        <button class="dsp-btn" @click="handleNewDeck">New Deck</button>
        <button class="dsp-btn" @click="emit('import')">Import</button>
      </div>
    </div>

    <div class="dsp-list">
      <div v-if="isLoading" class="dsp-empty">Loading decks...</div>
      <div v-else-if="filteredDecks.length === 0" class="dsp-empty">
        {{ search ? 'No matching decks.' : 'No saved decks yet.' }}
      </div>
      <div
        v-for="deck in filteredDecks"
        :key="deck.id"
        :class="['dsp-deck-row', { 'dsp-active': currentDeckId === deck.id }]"
        @click="switchToDeck(deck.id)"
      >
        <img
          v-if="coverUrl(deck)"
          :src="coverUrl(deck)"
          class="dsp-deck-cover"
        />
        <div v-else class="dsp-deck-cover-placeholder" />

        <div v-if="renamingId === deck.id" class="dsp-deck-info" @click.stop>
          <input
            v-model="renameValue"
            class="dsp-rename-input"
            autofocus
            @keyup.enter="confirmRename(deck.id)"
            @keyup.escape="renamingId = null"
            @blur="confirmRename(deck.id)"
          />
        </div>
        <div v-else class="dsp-deck-info">
          <div class="dsp-deck-name">{{ deck.name }}</div>
          <div class="dsp-deck-meta">
            <span>{{ deck.cardCount }}/60</span>
            <span class="dsp-sep">&middot;</span>
            <span>{{ timeAgo(deck.updatedAt) }}</span>
          </div>
        </div>

        <div class="dsp-deck-actions">
          <button class="dsp-menu-btn" @click="toggleMenu(deck.id, $event)">&#x22EF;</button>
          <div v-if="menuOpenId === deck.id" class="dsp-menu" @click.stop>
            <button @click="startRename(deck, $event)">Rename</button>
            <button @click="handleCopy(deck, $event)">Duplicate</button>
            <button class="dsp-menu-danger" @click="handleDelete(deck, $event)">Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <ConfirmDialog
      v-if="deleteTarget"
      title="Delete Deck"
      :message="`Are you sure you want to delete &quot;${deleteTarget.name}&quot;? This cannot be undone.`"
      confirm-label="Delete"
      @confirm="confirmDelete"
      @close="deleteTarget = null"
    />

    <!-- Unsaved changes guard -->
    <ConfirmDialog
      v-if="dirtyGuardTarget"
      title="Unsaved Changes"
      message="You have unsaved changes. Discard them and switch decks?"
      confirm-label="Discard & Switch"
      :confirm-danger="false"
      @confirm="confirmDirtySwitch"
      @close="dirtyGuardTarget = null; dirtyGuardNewDeck = false"
    />
  </div>
</template>
