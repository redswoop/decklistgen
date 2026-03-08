<script setup lang="ts">
import { ref, computed } from "vue";
import { useDecks } from "../composables/useDecks.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { DeckSummary } from "../../shared/types/deck.js";

const emit = defineEmits<{
  "select-deck": [id: string];
  collapse: [];
  import: [];
}>();

const props = defineProps<{
  selectedDeckId: string | null;
}>();

const { decks, isLoading, deleteDeck, copyDeck } = useDecks();

const search = ref("");
const renamingId = ref<string | null>(null);
const renameValue = ref("");
const menuOpenId = ref<string | null>(null);

const filteredDecks = computed(() => {
  if (!search.value) return decks.value;
  const q = search.value.toLowerCase();
  return decks.value.filter((d) => d.name.toLowerCase().includes(q));
});

function selectDeck(id: string) {
  menuOpenId.value = null;
  emit("select-deck", id);
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

const { updateDeck } = useDecks();

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

async function handleDelete(deck: DeckSummary, e: Event) {
  e.stopPropagation();
  menuOpenId.value = null;
  await deleteDeck(deck.id);
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

function coverUrl(deck: DeckSummary): string {
  return deck.coverImage ? cardImageUrl(deck.coverImage, "low") : "";
}
</script>

<template>
  <div class="sidebar dm-sidebar">
    <div class="sidebar-header">
      <span class="sidebar-header-title">Saved Decks</span>
      <button class="sidebar-collapse-btn" @click="emit('collapse')">&lsaquo;</button>
    </div>
    <div class="dm-sidebar-actions">
      <button class="dm-btn-import" @click="emit('import')">Import</button>
    </div>
    <div class="dm-search-wrap">
      <input
        v-model="search"
        type="text"
        class="dm-search"
        placeholder="Search decks..."
      />
    </div>
    <div class="dm-deck-list">
      <div v-if="isLoading" class="dm-loading">Loading decks...</div>
      <div v-else-if="filteredDecks.length === 0" class="dm-empty">
        {{ search ? 'No matching decks.' : 'No saved decks yet.' }}
      </div>
      <div
        v-for="deck in filteredDecks"
        :key="deck.id"
        :class="['dm-deck-row', { selected: selectedDeckId === deck.id }]"
        @click="selectDeck(deck.id)"
      >
        <img
          v-if="coverUrl(deck)"
          :src="coverUrl(deck)"
          class="dm-deck-cover"
        />
        <div v-else class="dm-deck-cover-placeholder" />

        <div v-if="renamingId === deck.id" class="dm-deck-info" @click.stop>
          <input
            v-model="renameValue"
            class="dm-rename-input"
            autofocus
            @keyup.enter="confirmRename(deck.id)"
            @keyup.escape="renamingId = null"
            @blur="confirmRename(deck.id)"
          />
        </div>
        <div v-else class="dm-deck-info">
          <div class="dm-deck-name">{{ deck.name }}</div>
          <div class="dm-deck-meta">
            <span>{{ deck.cardCount }}/60</span>
            <span class="dm-deck-sep">&middot;</span>
            <span>{{ timeAgo(deck.updatedAt) }}</span>
          </div>
          <div v-if="deck.importSource" class="dm-deck-source">
            {{ deck.importSource }}
          </div>
        </div>

        <div class="dm-deck-actions">
          <button class="dm-menu-btn" @click="toggleMenu(deck.id, $event)">&#x22EF;</button>
          <div v-if="menuOpenId === deck.id" class="dm-menu" @click.stop>
            <button @click="startRename(deck, $event)">Rename</button>
            <button @click="handleCopy(deck, $event)">Duplicate</button>
            <button class="dm-menu-danger" @click="handleDelete(deck, $event)">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
