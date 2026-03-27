import { ref, reactive, computed, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { api, ApiError } from "../lib/client.js";
import { cardImageUrl, type CardImageResolution } from "../../shared/utils/card-image-url.js";
import { useToast } from "./useToast.js";

export type ImageMode = "original" | "proxy";

/** Reactive flag: true when any card generation is in-flight (used by useQueue for polling) */
export const hasActiveGenerations = computed(() => generatingSet.size > 0);

// Read initial mode from URL
function readModeFromUrl(): ImageMode {
  const p = new URLSearchParams(window.location.search);
  const m = p.get("mode");
  if (m === "proxy" || m === "clean" || m === "composite") return "proxy";
  return "original";
}

// Global state
const imageMode: Ref<ImageMode> = ref(readModeFromUrl());
const generatingSet = reactive(new Set<string>());

// Status cache: cardId -> availability. Populated by batch queries.
const statusCache = reactive(new Map<string, { hasClean: boolean; hasComposite: boolean; hasSvg: boolean; mtime?: number }>());

// Global generation version counter per card — survives component unmount.
// Bump after successful generation so SVG URLs change and browsers re-fetch.
const generationVersion = reactive(new Map<string, number>());

/** Get a cache-busting version for image/SVG URLs.
 *  Uses server-provided mtime (survives page reload) + local generation counter
 *  (provides immediate cache-bust after in-session regeneration). */
export function getGenerationVersion(cardId: string): number {
  const mtime = statusCache.get(cardId)?.mtime ?? 0;
  const local = generationVersion.get(cardId) ?? 0;
  return mtime + local;
}

export function usePokeproxy() {
  return {
    imageMode,
    setImageMode(mode: ImageMode) {
      imageMode.value = mode;
      const url = new URL(window.location.href);
      if (mode === "original") url.searchParams.delete("mode");
      else url.searchParams.set("mode", "proxy");
      history.replaceState(null, "", url.toString());
    },
  };
}

/** Always batch-fetch pokeproxy status for visible cards */
export function usePokeproxyBatch(cardIds: Ref<string[]>) {
  return useQuery({
    queryKey: computed(() => ["pokeproxy-batch", ...cardIds.value]),
    queryFn: async () => {
      const ids = cardIds.value;
      if (ids.length === 0) return {};
      const results = await api.pokeproxyBatchStatus(ids);
      for (const [id, s] of Object.entries(results)) {
        statusCache.set(id, s);
      }
      return results;
    },
    enabled: computed(() => cardIds.value.length > 0),
    staleTime: 60_000,
  });
}

export function usePokeproxyStatus(cardId: Ref<string | undefined>) {
  return useQuery({
    queryKey: computed(() => ["pokeproxy-status", cardId.value]),
    queryFn: async () => {
      const result = await api.pokeproxyStatus(cardId.value!);
      statusCache.set(cardId.value!, result);
      return result;
    },
    enabled: computed(() => !!cardId.value),
  });
}

export function useVariants(cardId: Ref<string | undefined>, byName: Ref<boolean> = ref(false)) {
  return useQuery({
    queryKey: computed(() => ["variants", cardId.value, byName.value]),
    queryFn: () => api.getVariants(cardId.value!, byName.value).then((r) => r.variants),
    enabled: computed(() => !!cardId.value),
  });
}

/** Check if a card has a cleaned image available */
export function hasCleanedImage(cardId: string): boolean {
  const s = statusCache.get(cardId);
  return !!(s?.hasClean || s?.hasComposite);
}

/** Check if status has been fetched for a card */
export function hasStatusLoaded(cardId: string): boolean {
  return statusCache.has(cardId);
}

/** Check if a card is currently being generated */
export function isGenerating(cardId: string): boolean {
  return generatingSet.has(cardId);
}

/** Thumbnail width used for grid tiles when resolution is "low" */
const THUMB_WIDTH = 250;

/** Get the image URL, respecting mode and availability */
export function getCardImageUrl(
  card: { id: string; imageBase: string },
  mode: ImageMode,
  resolution: CardImageResolution = "high",
): string | null {
  if (mode === "original") return cardImageUrl(card.imageBase, resolution);

  const s = statusCache.get(card.id);
  if (!s) return null; // Status not loaded yet

  // Prefer composite, then clean, then fall back to original
  const v = getGenerationVersion(card.id);
  const w = resolution === "low" ? THUMB_WIDTH : undefined;
  if (s.hasComposite) return api.pokeproxyImageUrl(card.id, "composite", v, w);
  if (s.hasClean) return api.pokeproxyImageUrl(card.id, "clean", v, w);

  return cardImageUrl(card.imageBase, resolution); // Fall back to original art
}

/** Shared query client reference, set lazily on first use */
let _queryClient: ReturnType<typeof useQueryClient> | null = null;

/** Called when a generation job completes (from useQueue's completion watcher) */
export async function onGenerationCompleted(
  cardId: string,
  queryClient?: ReturnType<typeof useQueryClient>,
) {
  const qc = queryClient ?? _queryClient;
  // Refresh status in both statusCache and TanStack Query
  try {
    const newStatus = await api.pokeproxyStatus(cardId);
    statusCache.set(cardId, newStatus);
  } catch {}
  generationVersion.set(cardId, (generationVersion.get(cardId) ?? 0) + 1);
  generatingSet.delete(cardId);
  qc?.invalidateQueries({ queryKey: ["pokeproxy-status", cardId] });
  qc?.invalidateQueries({ queryKey: ["pokeproxy-batch"] });
}

/** Submit generation (now non-blocking — returns immediately after queuing) */
export async function generateCleanImage(cardId: string, force = false) {
  if (generatingSet.has(cardId)) return;
  generatingSet.add(cardId);
  const toast = useToast();
  try {
    const result = await api.pokeproxyGenerate(cardId, force);
    // If the server didn't actually queue a job (already_exists, skipped, etc.),
    // clear the generating state immediately — no queue completion will fire.
    if (result.status !== "queued") {
      generatingSet.delete(cardId);
    }
  } catch (e) {
    generatingSet.delete(cardId);
    if (e instanceof ApiError) {
      if (e.status === 401) toast.error("Sign in to generate images");
      else if (e.status === 403) toast.error("Your account is not authorized to generate images");
      else toast.error(`Generation failed: ${e.message}`);
    } else {
      toast.error("Generation failed unexpectedly");
    }
    console.error("Generate failed:", e);
  }
}

export async function regenerateSvg(cardId: string) {
  await api.pokeproxyRegenerateSvg(cardId);
}

/** Must be called from a component setup to capture the query client */
export function useGenerationQueryClient() {
  _queryClient = useQueryClient();
}
