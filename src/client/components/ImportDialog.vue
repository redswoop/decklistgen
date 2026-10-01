<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "../lib/client.js";
import { useDecklist, type DecklistItem } from "../composables/useDecklist.js";
import { useDeckSave } from "../composables/useDeckSave.js";
import { useAuth } from "../composables/useAuth.js";
import type { LimitlessPlayer, ImportResult } from "../../shared/types/decklist.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";

const emit = defineEmits<{ close: [] }>();

const { importDeck, currentDeckName, currentDeckId, items } = useDecklist();
const { saveAsNew } = useDeckSave();
const { isLoggedIn } = useAuth();

const tab = ref<"paste" | "url">("paste");
const mode = ref<"new" | "replace" | "merge">("new");
const deckName = ref("");
const loading = ref(false);
const error = ref("");
const success = ref("");

// URL tab state
const urlInput = ref("");
const tournamentName = ref("");
const tournamentId = ref("");
const players = ref<LimitlessPlayer[]>([]);
const selectedPlayer = ref("");
const playerFilter = ref("");

// Paste tab state
const pasteText = ref("");

// Default mode: "new" if no deck loaded, "replace" if editing an existing deck
if (currentDeckId.value && items.value.length > 0) {
  mode.value = "replace";
}

// Replace/merge keep the loaded deck's name; only a new deck takes one.
const nameIsForNewDeck = computed(() => mode.value === "new");
const nameInputPlaceholder = computed(() => {
  if (!nameIsForNewDeck.value && currentDeckName.value) return currentDeckName.value;
  return "Deck name...";
});

function filteredPlayers() {
  if (!playerFilter.value) return players.value;
  const q = playerFilter.value.toLowerCase();
  return players.value.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.deckName?.toLowerCase().includes(q) ?? false)
  );
}

/** Land the import in the working deck per `mode`, and describe what happened.
 *  "new" also saves the deck when signed in; replace/merge only dirty the loaded
 *  deck — the normal Save commits them, so the server copy is never silently
 *  swapped for a different deck. */
async function applyImport(newItems: DecklistItem[], source: string, autoName: string): Promise<string> {
  const total = newItems.reduce((s, c) => s + c.count, 0);
  const mergeTarget = currentDeckName.value || "the working deck";
  if (mode.value === "merge") {
    importDeck(newItems, "merge", source);
    return `Added ${total} cards to ${mergeTarget}. Save to keep them.`;
  }
  if (mode.value === "replace" && currentDeckId.value) {
    importDeck(newItems, "replace", source);
    return `Replaced the cards in ${mergeTarget} (${total} cards). Save to keep them.`;
  }
  importDeck(newItems, "new", source);
  if (!isLoggedIn.value) return `Imported ${total} cards to the working deck.`;
  const name = deckName.value.trim() || autoName;
  const saved = await saveAsNew(name);
  return saved
    ? `Imported ${total} cards (saved as "${name}").`
    : `Imported ${total} cards to the working deck, but saving failed.`;
}

async function fetchPlayers() {
  error.value = "";
  success.value = "";
  loading.value = true;
  try {
    const result = await api.importLimitlessPlayers(urlInput.value.trim());

    // Standalone decklist URL — resolved directly, import immediately
    if (result.directImport && result.cards) {
      const newItems: DecklistItem[] = result.cards.map((r) => ({
        setCode: r.card.setCode,
        localId: r.card.localId,
        count: r.count,
        name: r.card.name,
        imageUrl: cardImageUrl(r.card.imageBase, "low"),
        card: r.card,
      }));

      const source = urlInput.value.trim();
      success.value = await applyImport(newItems, source, "Imported deck");
      if (result.unresolved && result.unresolved.length > 0) {
        const names = result.unresolved.map((u) => `${u.count}x ${u.name}`).join(", ");
        error.value = `Could not resolve: ${names}`;
      }
      loading.value = false;
      return;
    }

    // Tournament URL — show player list
    tournamentId.value = result.tournamentId ?? "";
    tournamentName.value = result.tournamentName ?? "";
    players.value = result.players ?? [];
    selectedPlayer.value = "";
    if (players.value.length === 0) {
      error.value = "No decklists found in this tournament.";
    }
  } catch (e) {
    error.value = (e instanceof Error ? e.message : String(e)) || "Failed to fetch tournament";
  } finally {
    loading.value = false;
  }
}

async function doImport() {
  error.value = "";
  success.value = "";
  loading.value = true;
  try {
    let result: ImportResult;
    let autoName: string;
    if (tab.value === "url") {
      if (!selectedPlayer.value) {
        error.value = "Select a player first.";
        loading.value = false;
        return;
      }
      result = await api.importLimitlessDeck(tournamentId.value, selectedPlayer.value);
      const player = players.value.find((p) => p.name === selectedPlayer.value);
      autoName = player?.deckName
        ? `${player.deckName} (${selectedPlayer.value})`
        : selectedPlayer.value;
    } else {
      if (!pasteText.value.trim()) {
        error.value = "Paste a decklist first.";
        loading.value = false;
        return;
      }
      result = await api.importText(pasteText.value);
      autoName = "Pasted deck";
    }

    const newItems: DecklistItem[] = result.cards.map((r) => ({
      setCode: r.card.setCode,
      localId: r.card.localId,
      count: r.count,
      name: r.card.name,
      imageUrl: cardImageUrl(r.card.imageBase, "low"),
      card: r.card,
    }));

    const source = tab.value === "url" ? urlInput.value.trim() : "Pasted decklist";
    success.value = await applyImport(newItems, source, autoName);
    if (result.unresolved.length > 0) {
      const names = result.unresolved.map((u) => `${u.count}x ${u.name}`).join(", ");
      error.value = `Could not resolve: ${names}`;
    }
  } catch (e) {
    error.value = (e instanceof Error ? e.message : String(e)) || "Import failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="import-dialog" @click.stop>
      <h3>Import Decklist</h3>

      <div class="import-tabs">
        <button :class="['import-tab', { active: tab === 'paste' }]" @click="tab = 'paste'">
          Paste List
        </button>
        <button :class="['import-tab', { active: tab === 'url' }]" @click="tab = 'url'">
          From URL
        </button>
      </div>

      <!-- Paste Tab -->
      <div v-if="tab === 'paste'" class="import-body">
        <textarea
          v-model="pasteText"
          placeholder="Paste decklist here...

PAR 089 x3  # Iron Valiant ex
MEW 151 x2  # Mew ex

or PTCGO format:

4 Charizard ex OBF 125
2 Charmander PAF 7"
          class="import-textarea"
        />
      </div>

      <!-- URL Tab -->
      <div v-if="tab === 'url'" class="import-body">
        <div class="import-url-row">
          <input
            v-model="urlInput"
            type="text"
            placeholder="Limitless URL (tournament or decklist)..."
            class="import-input"
            @keyup.enter="fetchPlayers"
          />
          <button class="btn-fetch" :disabled="loading || !urlInput.trim()" @click="fetchPlayers">
            {{ loading && !players.length ? "Loading..." : "Fetch" }}
          </button>
        </div>

        <div v-if="tournamentName" class="import-tournament-name">
          {{ tournamentName }}
        </div>

        <div v-if="players.length > 0" class="import-player-section">
          <input
            v-model="playerFilter"
            type="text"
            placeholder="Filter players..."
            class="import-input import-filter"
          />
          <div class="import-player-list">
            <div
              v-for="p in filteredPlayers()"
              :key="p.name"
              :class="['import-player-row', { selected: selectedPlayer === p.name }]"
              @click="selectedPlayer = p.name"
            >
              <span class="player-placing">#{{ p.placing }}</span>
              <span class="player-name">{{ p.name }}</span>
              <span class="player-record">
                {{ p.record.wins }}-{{ p.record.losses }}-{{ p.record.ties }}
              </span>
              <span v-if="p.deckName" class="player-deck">{{ p.deckName }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="success" class="import-success">{{ success }}</div>
      <div v-if="error" class="import-error">{{ error }}</div>

      <div class="import-footer">
        <input
          v-model="deckName"
          type="text"
          :placeholder="nameInputPlaceholder"
          :disabled="!nameIsForNewDeck"
          :title="nameIsForNewDeck ? 'Name for the new deck' : 'Replace and Merge keep the loaded deck\'s name'"
          class="import-input import-name-input"
        />
        <div class="import-mode">
          <label>
            <input v-model="mode" type="radio" value="new" /> New Deck
          </label>
          <label>
            <input v-model="mode" type="radio" value="replace" :disabled="!currentDeckId" :title="!currentDeckId ? 'No deck loaded to replace' : ''" /> Replace
          </label>
          <label>
            <input v-model="mode" type="radio" value="merge" :disabled="!items.length" :title="!items.length ? 'No deck loaded to merge into' : ''" /> Merge
          </label>
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="emit('close')">{{ success ? "Done" : "Cancel" }}</button>
          <button
            v-if="!success"
            class="btn-primary"
            :disabled="loading || (tab === 'url' && !selectedPlayer) || (tab === 'paste' && !pasteText.trim())"
            @click="doImport"
          >
            {{ loading ? "Importing..." : "Import" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
