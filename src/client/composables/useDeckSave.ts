import { ref } from "vue";
import { useDecklist } from "./useDecklist.js";
import { useDecks } from "./useDecks.js";
import { useToast } from "./useToast.js";
import { ApiError } from "../lib/client.js";

// Module-level so every surface (context bar, save-before-print) shows the
// same in-flight state and can't double-submit.
const saving = ref(false);

function reportSaveError(e: unknown, verb: string) {
  const toast = useToast();
  if (e instanceof ApiError && e.isAuthError) {
    toast.error(e.status === 401 ? `Sign in to ${verb} decks` : `Not authorized to ${verb} decks`);
  } else {
    toast.error(`Failed to ${verb} deck`);
  }
  console.error(`Deck ${verb} failed:`, e);
}

/**
 * The one place the working deck is written to the server. Two shapes:
 *  - `saveCurrent()` — PUT the loaded deck in place (name + cards).
 *  - `saveAsNew(name)` — POST the working cards as a new deck and make it the
 *    loaded deck. Serves both "save this new deck" and "duplicate".
 * Both resolve to true on success and toast on failure; nothing throws.
 */
export function useDeckSave() {
  const {
    currentDeckId, currentDeckName, isDirty,
    toDeckCards, markSaved, importSource, importedAt,
  } = useDecklist();
  const { createDeck, updateDeck } = useDecks();

  async function saveCurrent(): Promise<boolean> {
    const id = currentDeckId.value;
    if (!id || saving.value) return false;
    if (!isDirty.value) return true;
    saving.value = true;
    try {
      await updateDeck({ id, data: { name: currentDeckName.value, cards: toDeckCards() } });
      markSaved(id, currentDeckName.value);
      return true;
    } catch (e) {
      reportSaveError(e, "save");
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function saveAsNew(name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed || saving.value) return false;
    saving.value = true;
    try {
      const deck = await createDeck({
        name: trimmed,
        cards: toDeckCards(),
        importedAt: importedAt.value ?? undefined,
        importSource: importSource.value ?? undefined,
      });
      markSaved(deck.id, deck.name);
      return true;
    } catch (e) {
      reportSaveError(e, "save");
      return false;
    } finally {
      saving.value = false;
    }
  }

  return { saving, saveCurrent, saveAsNew };
}
