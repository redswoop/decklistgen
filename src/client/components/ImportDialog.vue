<script setup lang="ts">
import { ref } from "vue";
import { api } from "../lib/client.js";
import { useDecklist, type DecklistItem } from "../composables/useDecklist.js";
import { useDecks } from "../composables/useDecks.js";
import type { LimitlessPlayer, ImportResult } from "../../shared/types/decklist.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";

const emit = defineEmits<{ close: [] }>();

const { importDeck, markSaved } = useDecklist();
const { createDeck } = useDecks();

const tab = ref<"url" | "paste">("url");
const mode = ref<"replace" | "merge">("replace");
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

function filteredPlayers() {
  if (!playerFilter.value) return players.value;
  const q = playerFilter.value.toLowerCase();
  return players.value.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.deckName?.toLowerCase().includes(q) ?? false)
  );
}

/** Auto-save imported cards as a deck on the server */
async function autoSaveDeck(items: DecklistItem[], source: string, deckName?: string) {
  const name = deckName || source || "Imported deck";
  try {
    const deck = await createDeck({
      name,
      cards: items.map((i) => ({ count: i.count, card: i.card })),
      importedAt: new Date().toISOString(),
      importSource: source || undefined,
    });
    markSaved(deck.id, deck.name);
  } catch (e) {
    // Auto-save is best-effort — don't block the import on failure
    console.warn("Auto-save deck failed:", e);
  }
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
      importDeck(newItems, mode.value, source);
      await autoSaveDeck(newItems, source);

      const total = result.cards.reduce((s, c) => s + c.count, 0);
      if (result.unresolved && result.unresolved.length > 0) {
        const names = result.unresolved.map((u) => `${u.count}x ${u.name}`).join(", ");
        error.value = `Could not resolve: ${names}`;
        success.value = `Imported ${total} cards (saved).`;
      } else {
        success.value = `Imported ${total} cards (saved).`;
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
  } catch (e: any) {
    error.value = e.message || "Failed to fetch tournament";
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
    let deckName: string | undefined;
    if (tab.value === "url") {
      if (!selectedPlayer.value) {
        error.value = "Select a player first.";
        loading.value = false;
        return;
      }
      result = await api.importLimitlessDeck(tournamentId.value, selectedPlayer.value);
      // Use player name + deck archetype as the deck name
      const player = players.value.find((p) => p.name === selectedPlayer.value);
      deckName = player?.deckName
        ? `${player.deckName} (${selectedPlayer.value})`
        : selectedPlayer.value;
    } else {
      if (!pasteText.value.trim()) {
        error.value = "Paste a decklist first.";
        loading.value = false;
        return;
      }
      result = await api.importText(pasteText.value);
      deckName = "Pasted deck";
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
    importDeck(newItems, mode.value, source);
    await autoSaveDeck(newItems, source, deckName);

    const total = result.cards.reduce((s, c) => s + c.count, 0);
    if (result.unresolved.length > 0) {
      const names = result.unresolved.map((u) => `${u.count}x ${u.name}`).join(", ");
      error.value = `Could not resolve: ${names}`;
    }
    success.value = `Imported ${total} cards (saved).`;
  } catch (e: any) {
    error.value = e.message || "Import failed";
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
        <button :class="['import-tab', { active: tab === 'url' }]" @click="tab = 'url'">
          From URL
        </button>
        <button :class="['import-tab', { active: tab === 'paste' }]" @click="tab = 'paste'">
          Paste List
        </button>
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

      <!-- Paste Tab -->
      <div v-if="tab === 'paste'" class="import-body">
        <textarea
          v-model="pasteText"
          placeholder="Paste PTCGO/PTCGL decklist here...

Pokémon: 15
4 Charizard ex OBF 125
2 Charmander PAF 7
...

Trainer: 32
4 Arven OBF 186
...

Energy: 8
5 Fire Energy SVE 2
..."
          class="import-textarea"
        />
      </div>

      <div v-if="success" class="import-success">{{ success }}</div>
      <div v-if="error" class="import-error">{{ error }}</div>

      <div class="import-footer">
        <div class="import-mode">
          <label>
            <input v-model="mode" type="radio" value="replace" /> Replace
          </label>
          <label>
            <input v-model="mode" type="radio" value="merge" /> Merge
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
