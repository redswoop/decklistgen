import { ref } from "vue";
import { api, ApiError } from "../lib/client.js";
import type { Card, CardDetail } from "../../shared/types/card.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import { shouldPrintCard } from "../../shared/utils/print-filter.js";
import type { PrintParams, ArtMode } from "../../shared/utils/print-params.js";

export interface PrintEntry {
  card: Card;
  detail?: CardDetail;
  artUrl: string;
  /** Print as a plain <img> (original/cleaned) rather than the CSS proxy. */
  plain: boolean;
}

/**
 * Loads the print sheet's card entries for whichever data path the URL selected
 * (explicit cardId list / saved deck / gallery selection). Owns the entries +
 * error refs; the controller (PrintSheet) keeps the readiness state machine and
 * layout. Network-bound — exercised by the print e2e suite, not unit-tested.
 */
export function usePrintLoader(params: PrintParams) {
  const entries = ref<PrintEntry[]>([]);
  const error = ref("");

  /**
   * Pick the art URL for a print slot. With `art=original`, use the full TCGdex
   * card scan (printed plainly). Otherwise prefer the cached `clean` PNG, falling
   * back to original if none exists so a fresh deck still prints something.
   */
  async function resolveArtUrl(card: Card, artMode: ArtMode): Promise<string> {
    if (artMode === "original") {
      return cardImageUrl(card.imageBase, "high") || "";
    }
    try {
      const status = await api.pokeproxyStatus(card.id);
      if (status.hasClean || status.hasComposite) {
        return api.pokeproxyImageUrl(card.id, "clean");
      }
    } catch {
      // Status endpoint is best-effort; fall through to the original art.
    }
    return cardImageUrl(card.imageBase, "high") || "";
  }

  async function buildEntry(card: Card, count: number, artMode: ArtMode): Promise<PrintEntry[]> {
    let detail: CardDetail | undefined;
    try {
      detail = await api.getCardDetail(card.id);
    } catch {
      detail = undefined;
    }
    if (!shouldPrintCard(card, detail, { exclude: params.excludeSet, noBasicEnergy: params.noBasicEnergy })) {
      return [];
    }
    const artUrl = await resolveArtUrl(card, artMode);
    const plain = artMode !== "proxy";
    const repeats = params.qtyOneEach ? 1 : Math.max(1, count);
    const out: PrintEntry[] = [];
    for (let i = 0; i < repeats; i++) out.push({ card, detail, artUrl, plain });
    return out;
  }

  async function loadDeck(id: string): Promise<void> {
    let deck;
    try {
      deck = await api.getDeck(id);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
        // Try the public endpoint so anonymous users can print shared decks.
        deck = await api.getPublicDeck(id);
      } else {
        throw e;
      }
    }
    const out: PrintEntry[] = [];
    for (const dc of deck.cards) {
      const card = dc.artCard ?? dc.card;
      out.push(...(await buildEntry(card, dc.count, params.defaultArtMode)));
    }
    entries.value = out;
  }

  /**
   * Explicit card-ID print (lightbox "Print Jumbo"). Skips shouldPrintCard (the
   * user picked these directly), prints one copy of each, and honours a per-card
   * art list when it lines up with the card list. A card the server can't resolve
   * is skipped so the rest of the sheet still prints.
   */
  async function loadCards(ids: string[]): Promise<void> {
    const out: PrintEntry[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      let card;
      try {
        card = await api.getCard(id);
      } catch {
        continue;
      }
      let detail: CardDetail | undefined;
      try {
        detail = await api.getCardDetail(id);
      } catch {
        detail = undefined;
      }
      const artMode = params.artModes[i] ?? params.defaultArtMode;
      const artUrl = await resolveArtUrl(card, artMode);
      out.push({ card, detail, artUrl, plain: artMode !== "proxy" });
    }
    entries.value = out;
  }

  async function loadGallery(): Promise<void> {
    const raw = sessionStorage.getItem("gallery-print-ids");
    if (!raw) {
      error.value = "No gallery selection found (open Print from the Gallery again).";
      return;
    }
    let ids: string[];
    try {
      ids = JSON.parse(raw);
    } catch {
      error.value = "Could not parse gallery selection.";
      return;
    }
    const out: PrintEntry[] = [];
    for (const id of ids) {
      try {
        const card = await api.getCard(id);
        out.push(...(await buildEntry(card, 1, params.defaultArtMode)));
      } catch {
        // Skip cards the server can't resolve; keep building the sheet.
      }
    }
    entries.value = out;
  }

  /**
   * Dispatch to the right loader for the URL's data path. Returns "no-params"
   * (after setting `error`) when none of cardId/deckId/gallery was supplied, so
   * the controller can publish the terminal error state. Loaders may also set
   * `error` without throwing (e.g. a missing gallery selection) — that path
   * still resolves "ok" and renders the empty state, matching prior behavior.
   */
  async function load(): Promise<"ok" | "no-params"> {
    if (params.cardIds.length) {
      await loadCards(params.cardIds);
      return "ok";
    }
    if (params.deckId) {
      await loadDeck(params.deckId);
      return "ok";
    }
    if (params.isGallery) {
      await loadGallery();
      return "ok";
    }
    error.value = "No cardId, deckId or gallery=1 parameter supplied.";
    return "no-params";
  }

  return { entries, error, load };
}
