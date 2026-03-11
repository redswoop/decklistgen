import type { Card, CardDetail, SetInfo } from "../../shared/types/card.js";
import type { CardFilters } from "../../shared/types/filters.js";
import type { FilterOptions } from "../../shared/types/filters.js";
import type { DecklistEntry, DecklistOutput, LimitlessPlayer, ImportResult } from "../../shared/types/decklist.js";
import type { ProxySettings } from "../../shared/types/proxy-settings.js";
import type { SavedDeck, DeckSummary, DeckCard } from "../../shared/types/deck.js";
import type { CustomizedCardsResponse } from "../../shared/types/customized-card.js";
import type { BeautifyOptions, BeautifyPreview } from "../../shared/types/beautify.js";
import type { User, AdminUser, MagicLink } from "../../shared/types/user.js";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly serverMessage?: string,
  ) {
    super(serverMessage ?? `${status} ${statusText}`);
    this.name = "ApiError";
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

async function handleResponse<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let serverMessage: string | undefined;
    try {
      const body = await resp.json();
      serverMessage = body?.error;
    } catch {}
    throw new ApiError(resp.status, resp.statusText, serverMessage);
  }
  return resp.json();
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  url.pathname = BASE + path;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const resp = await fetch(url.toString(), { credentials: "include" });
  return handleResponse<T>(resp);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  return handleResponse<T>(resp);
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  return handleResponse<T>(resp);
}

async function del<T>(path: string): Promise<T> {
  const resp = await fetch(BASE + path, { method: "DELETE", credentials: "include" });
  return handleResponse<T>(resp);
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  return handleResponse<T>(resp);
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
  // Auth endpoints
  getMe: () => get<User & { needsSetup?: boolean }>("/auth/me"),
  setup: (data: { email: string; password: string; displayName: string }) =>
    post<User>("/auth/setup", data),
  login: (data: { email: string; password: string }) =>
    post<User>("/auth/login", data),
  logout: () => post<{ ok: boolean }>("/auth/logout", {}),

  // Magic link endpoints
  validateMagicLink: (token: string) =>
    get<{ email: string; displayName: string }>(`/auth/magic/${token}`),
  redeemMagicLink: (token: string, password: string) =>
    post<User>(`/auth/magic/${token}`, { password }),

  // Admin endpoints
  listUsers: () => get<AdminUser[]>("/admin/users"),
  authorizeUser: (id: string, authorized: boolean) =>
    patch<User>(`/admin/users/${id}/authorize`, { authorized }),
  setUserAdmin: (id: string, isAdmin: boolean) =>
    patch<User>(`/admin/users/${id}/admin`, { isAdmin }),
  deleteUser: (id: string) => del<{ ok: boolean }>(`/admin/users/${id}`),
  createMagicLink: (data: { email: string; displayName: string; isAuthorized?: boolean; isAdmin?: boolean }) =>
    post<MagicLink>("/admin/magic-links", data),
  listMagicLinks: () => get<MagicLink[]>("/admin/magic-links"),
  deleteMagicLink: (token: string) => del<{ ok: boolean }>(`/admin/magic-links/${token}`),

  // Sets & cards
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
  pokeproxyImageUrl: (cardId: string, type: "clean" | "composite" = "composite", version?: number) => {
    const base = `/api/pokeproxy/image/${cardId}/${type}`;
    return version ? `${base}?v=${version}` : base;
  },
  pokeproxySvgUrl: (cardId: string, settings?: ProxySettings, version?: number) => {
    const base = `/api/pokeproxy/svg/${cardId}`;
    const params = new URLSearchParams();
    if (settings?.fontSize != null) params.set("fontSize", String(settings.fontSize));
    if (settings?.maxCover != null) params.set("maxCover", String(settings.maxCover));
    if (version) params.set("v", String(version));
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
  beautifyDeck: (id: string, options: BeautifyOptions) =>
    post<{ deck?: SavedDeck; candidates?: BeautifyPreview[] }>(`/decks/${id}/beautify`, options),
  setDeckVisibility: (id: string, visibility: { isPublic?: boolean; isListed?: boolean }) =>
    patch<SavedDeck>(`/decks/${id}/visibility`, visibility),

  // Public decks
  listPublicDecks: (page = 1, pageSize = 20) =>
    get<{ decks: DeckSummary[]; total: number }>("/public/decks", { page: String(page), pageSize: String(pageSize) }),
  getPublicDeck: (id: string) => get<SavedDeck>(`/public/decks/${id}`),
  copyPublicDeck: (id: string) => post<SavedDeck>(`/public/decks/${id}/copy`, {}),

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
