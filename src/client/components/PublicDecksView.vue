<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../lib/client.js";
import { useAuth } from "../composables/useAuth.js";
import type { DeckSummary, SavedDeck } from "../../shared/types/deck.js";

const { isLoggedIn } = useAuth();
const decks = ref<DeckSummary[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const viewingDeck = ref<SavedDeck | null>(null);
const copying = ref(false);
const copySuccess = ref<string | null>(null);

async function loadDecks() {
  loading.value = true;
  try {
    const result = await api.listPublicDecks(page.value);
    decks.value = result.decks;
    total.value = result.total;
  } catch {}
  loading.value = false;
}

async function viewDeck(id: string) {
  try {
    const deck = await api.getPublicDeck(id);
    viewingDeck.value = deck;
  } catch {}
}

async function copyDeck(id: string) {
  copying.value = true;
  copySuccess.value = null;
  try {
    const copy = await api.copyPublicDeck(id);
    copySuccess.value = `Copied as "${copy.name}"`;
    setTimeout(() => { copySuccess.value = null; }, 3000);
  } catch {}
  copying.value = false;
}

function closeDeck() {
  viewingDeck.value = null;
}

onMounted(loadDecks);
</script>

<template>
  <div class="public-decks">
    <!-- Deck detail overlay -->
    <div v-if="viewingDeck" class="public-deck-detail">
      <div class="public-deck-detail-header">
        <h2>{{ viewingDeck.name }}</h2>
        <div class="public-deck-detail-actions">
          <button
            class="btn btn-primary"
            :disabled="copying || !isLoggedIn"
            :title="!isLoggedIn ? 'Sign in to copy decks' : undefined"
            @click="copyDeck(viewingDeck.id)"
          >{{ copying ? "Copying..." : "Copy to My Decks" }}</button>
          <button class="btn" @click="closeDeck">Close</button>
        </div>
      </div>
      <div v-if="copySuccess" class="copy-success">{{ copySuccess }}</div>
      <div class="public-deck-cards">
        <div
          v-for="entry in viewingDeck.cards"
          :key="entry.card.id"
          class="public-deck-card"
        >
          <img
            v-if="entry.card.imageBase"
            :src="entry.card.imageBase + '/high.webp'"
            :alt="entry.card.name"
            loading="lazy"
          />
          <div class="public-deck-card-info">
            <span class="public-deck-card-count">x{{ entry.count }}</span>
            <span class="public-deck-card-name">{{ entry.card.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Deck list -->
    <div v-else>
      <h2 class="public-decks-title">Public Decks</h2>
      <div v-if="loading" class="public-decks-loading">Loading...</div>
      <div v-else-if="decks.length === 0" class="public-decks-empty">
        No public decks yet.
      </div>
      <div v-else class="public-decks-grid">
        <div
          v-for="deck in decks"
          :key="deck.id"
          class="public-deck-item"
          @click="viewDeck(deck.id)"
        >
          <div class="public-deck-cover">
            <img
              v-if="deck.coverImage"
              :src="deck.coverImage + '/high.webp'"
              :alt="deck.name"
              loading="lazy"
            />
            <div v-else class="public-deck-cover-placeholder">No image</div>
          </div>
          <div class="public-deck-meta">
            <div class="public-deck-name">{{ deck.name }}</div>
            <div class="public-deck-stats">
              {{ deck.cardCount }} cards
              <span v-if="deck.ownerName"> &middot; by {{ deck.ownerName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.public-decks {
  padding: 16px;
  overflow-y: auto;
  height: 100%;
}

.public-decks-title {
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 16px;
}

.public-decks-loading,
.public-decks-empty {
  color: #7f8fa6;
  font-size: 13px;
  text-align: center;
  padding: 40px;
}

.public-decks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.public-deck-item {
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s;
}

.public-deck-item:hover {
  border-color: #e94560;
}

.public-deck-cover {
  height: 120px;
  overflow: hidden;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
}

.public-deck-cover img {
  height: 100%;
  object-fit: cover;
}

.public-deck-cover-placeholder {
  color: #7f8fa6;
  font-size: 11px;
}

.public-deck-meta {
  padding: 8px 10px;
}

.public-deck-name {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.public-deck-stats {
  font-size: 11px;
  color: #7f8fa6;
  margin-top: 2px;
}

/* Detail view */
.public-deck-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.public-deck-detail-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
  flex: 1;
}

.public-deck-detail-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #7f8fa6;
  font-size: 12px;
  cursor: pointer;
}

.btn:hover {
  background: #0f3460;
  color: #e0e0e0;
}

.btn-primary {
  background: #e94560;
  border-color: #e94560;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #d13553;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.copy-success {
  background: rgba(46, 213, 115, 0.15);
  color: #2ed573;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 12px;
}

.public-deck-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.public-deck-card {
  text-align: center;
}

.public-deck-card img {
  width: 100%;
  border-radius: 4px;
}

.public-deck-card-info {
  font-size: 11px;
  color: #7f8fa6;
  margin-top: 4px;
}

.public-deck-card-count {
  font-weight: 600;
  color: #e0e0e0;
}
</style>
