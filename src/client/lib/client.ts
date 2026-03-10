import type { Card, CardDetail, SetInfo } from "../../shared/types/card.js";
import type { CardFilters } from "../../shared/types/filters.js";
import type { FilterOptions } from "../../shared/types/filters.js";
import type { DecklistEntry, DecklistOutput, LimitlessPlayer, ImportResult } from "../../shared/types/decklist.js";
import type { ProxySettings } from "../../shared/types/proxy-settings.js";
import type { SavedDeck, DeckSummary, DeckCard } from "../../shared/types/deck.js";
import type { CustomizedCardsResponse } from "../../shared/types/customized-card.js";

const BASE = "/api";

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  url.pathname = BASE + path;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

async function del<T>(path: string): Promise<T> {
  const resp = await fetch(BASE + path, { method: "DELETE" });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

export function filtersToParams(filters: CardFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.sets?.length) params.sets = filters.sets.join(",");
  if (filters.era) params.era = filters.era;
  if (filters.category) params.category = filters.category;
  if (filters.trainerType) params.trainerType = filters.trainerType;
  if (filters.rarities?.length) params.rarities = filters.rarities.join(",");
  if (filters.energyTypes?.length) params.energyTypes = filters.energyTypes.join(",");
  if (filters.specialAttributes?.length) params.specialAttributes = filters.specialAttributes.join(",");
  if (filters.isFullArt !== undefined) params.isFullArt = String(filters.isFullArt);
  if (filters.hasFoil !== undefined) params.hasFoil = String(filters.hasFoil);
  if (filters.nameSearch) params.nameSearch = filters.nameSearch;
  return params;
}

export interface PokeproxyStatus {
  cardId: string;
  hasClean: boolean;
  hasComposite: boolean;
  hasSvg: boolean;
  hasOriginal?: boolean;
}

export const api = {
  getSets: () => get<SetInfo[]>("/sets"),
  loadSet: (code: string) => post<{ loaded: number; code: string }>(`/sets/${code}/load`, {}),
  loadEra: (era: string) => post<{ loaded: number; sets: string[] }>(`/sets/load-era/${era}`, {}),
  getCards: (filters: CardFilters, page = 1, pageSize = 60) =>
    get<{ cards: Card[]; total: number; page: number; pageSize: number }>(
      "/cards",
      { ...filtersToParams(filters), page: String(page), pageSize: String(pageSize) }
    ),
  getFilterOptions: () => get<FilterOptions>("/cards/filters"),
  generateDecklist: (entries: DecklistEntry[]) =>
    post<DecklistOutput>("/decklist/generate", { entries }),
  importLimitlessPlayers: (url: string) =>
    post<{
      directImport?: boolean;
      cards?: ImportResult["cards"];
      unresolved?: ImportResult["unresolved"];
      tournamentId?: string;
      tournamentName?: string;
      playerCount?: number;
      players?: LimitlessPlayer[];
    }>("/decklist/import/limitless/players", { url }),
  importLimitlessDeck: (tournamentId: string, playerName: string) =>
    post<ImportResult>("/decklist/import/limitless/deck", { tournamentId, playerName }),
  importText: (text: string) =>
    post<ImportResult>("/decklist/import/text", { text }),
  getCard: (cardId: string) =>
    get<Card>(`/cards/${cardId}`),
  getCardDetail: (cardId: string) =>
    get<CardDetail>(`/cards/${cardId}/detail`),
  getVariants: (cardId: string) =>
    get<{ variants: Card[] }>(`/cards/${cardId}/variants`),
  getCardTcgdex: (cardId: string) =>
    get<Record<string, unknown>>(`/cards/${cardId}/tcgdex`),

  // PokeProxy endpoints
  pokeproxyStatus: (cardId: string) =>
    get<PokeproxyStatus>(`/pokeproxy/status/${cardId}`),
  pokeproxyBatchStatus: (cardIds: string[]) =>
    post<Record<string, { hasClean: boolean; hasComposite: boolean; hasSvg: boolean }>>(
      "/pokeproxy/status/batch", { cardIds }
    ),
  pokeproxyImageUrl: (cardId: string, type: "clean" | "composite" = "composite") =>
    `/api/pokeproxy/image/${cardId}/${type}`,
  pokeproxySvgUrl: (cardId: string, settings?: ProxySettings) => {
    const base = `/api/pokeproxy/svg/${cardId}`;
    if (!settings) return base;
    const params = new URLSearchParams();
    if (settings.fontSize != null) params.set("fontSize", String(settings.fontSize));
    if (settings.maxCover != null) params.set("maxCover", String(settings.maxCover));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  },
  pokeproxyEnergyPreviewUrl: () => `/api/pokeproxy/energy-preview`,
  pokeproxyGenerate: (cardId: string, force = false) =>
    post<{ cardId: string; status: string; output?: string }>(`/pokeproxy/generate/${cardId}${force ? "?force=true" : ""}`, {}),
  pokeproxyRegenerateSvg: (cardId: string) =>
    post<{ cardId: string; status: string }>(`/pokeproxy/svg/${cardId}/regenerate`, {}),
  pokeproxyGetPrompt: (cardId: string) =>
    get<{
      cardId: string;
      ruleName: string;
      prompt: string | null;
      skip: boolean;
      lastUsed: { prompt?: string; seed?: number; rule?: string } | null;
    }>(`/pokeproxy/prompt/${cardId}`),
  pokeproxySavePrompt: (cardId: string, prompt: string) =>
    put<{ cardId: string; status: string }>(`/pokeproxy/prompt/${cardId}`, { prompt }),

  // Deck management endpoints
  listDecks: () => get<DeckSummary[]>("/decks"),
  getDeck: (id: string) => get<SavedDeck>(`/decks/${id}`),
  createDeck: (data: { name: string; cards: DeckCard[]; importedAt?: string; importSource?: string }) =>
    post<SavedDeck>("/decks", data),
  updateDeck: (id: string, data: Partial<SavedDeck>) =>
    put<SavedDeck>(`/decks/${id}`, data),
  deleteDeck: (id: string) => del<{ ok: boolean }>(`/decks/${id}`),
  copyDeck: (id: string, name?: string) =>
    post<SavedDeck>(`/decks/${id}/copy`, { name }),
  diversifyDeck: (id: string) =>
    post<SavedDeck>(`/decks/${id}/diversify`, {}),

  // Card settings endpoints
  getCardSettings: (cardId: string) =>
    get<ProxySettings>(`/pokeproxy/settings/${cardId}`),
  updateCardSettings: (cardId: string, patch: Partial<ProxySettings>) =>
    put<ProxySettings>(`/pokeproxy/settings/${cardId}`, patch),
  deleteCardSettings: (cardId: string) =>
    del<{ ok: boolean }>(`/pokeproxy/settings/${cardId}`),

  // Customized cards endpoints
  getCustomizedCards: () =>
    get<CustomizedCardsResponse>("/pokeproxy/customized"),
  deleteCustomization: (cardId: string) =>
    del<{ ok: boolean; cardId: string }>(`/pokeproxy/customized/${cardId}`),
  batchDeleteCustomizations: (cardIds: string[]) =>
    post<{ ok: boolean; deleted: number }>("/pokeproxy/customized/batch/delete", { cardIds }),
};
