import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TcgdexCard, TcgdexSet } from "../../shared/types/card.js";

const DEFAULT_CACHE_DIR = join(import.meta.dir, "../../../cache");
const BASE_URL = "https://api.tcgdex.net/v2/en";
const UA = "DecklistGen/1.0";

// Read per call (not at import) so tests can point the fetcher at a temp dir.
function cacheDir(): string {
  return process.env.TCGDEX_CACHE_DIR ?? DEFAULT_CACHE_DIR;
}

async function ensureCache() {
  const dir = cacheDir();
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

const RETRY_DELAYS_MS = [500, 1500, 4000];

/** Test hook: shrink the backoff so retry tests don't sleep for real. */
export function _setRetryDelaysForTests(delays: number[] | null): void {
  retryDelays = delays ?? RETRY_DELAYS_MS;
}
let retryDelays = RETRY_DELAYS_MS;

function isTransient(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * GET + JSON with retries on transient failures. TCGdex is a free community
 * API and throws 503s now and then (it took down a CI run on 2026-10-09, where
 * there is no cache/ to fall back on). 4xx other than 429 are not retried.
 */
async function fetchJson<T>(url: string): Promise<T> {
  console.log(`  Fetching: ${url}`);
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    if (attempt > 0) {
      console.warn(`  Retry ${attempt}/${retryDelays.length} for ${url}: ${lastError?.message}`);
      await new Promise((r) => setTimeout(r, retryDelays[attempt - 1]));
    }
    let resp: Response;
    try {
      resp = await fetch(url, { headers: { "User-Agent": UA } });
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      continue; // network error — retry
    }
    if (resp.ok) return await resp.json() as T;
    lastError = new Error(`HTTP ${resp.status} for ${url}`);
    if (!isTransient(resp.status)) throw lastError;
  }
  throw lastError ?? new Error(`Fetch failed for ${url}`);
}

/**
 * TCGdex publishes new sets half-populated and backfills fields (notably
 * `evolveFrom` and Trainer `effect` text) over the following weeks. A cached
 * card JSON that is missing data a Stage 1/2 Pokémon or a Trainer must have is
 * treated as stale and re-fetched — once
 * per process, so an upstream that still hasn't backfilled doesn't turn every
 * set load into a network storm. The stale copy is kept if the network fails.
 */
export function isIncompleteCard(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const c = raw as { category?: unknown; stage?: unknown; evolveFrom?: unknown; effect?: unknown };
  if (c.category === "Trainer") return typeof c.effect !== "string" || c.effect === "";
  if (c.category !== "Pokemon") return false;
  const stage = typeof c.stage === "string" ? c.stage.toLowerCase() : "";
  if (stage !== "stage1" && stage !== "stage2") return false;
  return typeof c.evolveFrom !== "string" || c.evolveFrom === "";
}

const refreshAttempted = new Set<string>();

/** Test hook: forget which stale entries were already retried this process. */
export function resetStaleRefreshTracking(): void {
  refreshAttempted.clear();
}

async function cachedFetch<T>(
  cacheKey: string,
  url: string,
  isStale?: (data: T) => boolean,
): Promise<T> {
  await ensureCache();
  const cacheFile = join(cacheDir(), `${cacheKey}.json`);
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, "utf-8")) as T;
    if (!isStale?.(cached) || refreshAttempted.has(cacheKey)) return cached;
    refreshAttempted.add(cacheKey);
    try {
      const fresh = await fetchJson<T>(url);
      await writeFile(cacheFile, JSON.stringify(fresh, null, 2));
      return fresh;
    } catch (e) {
      console.warn(`  Refresh of stale ${cacheKey} failed, keeping cached copy: ${(e as Error).message}`);
      return cached;
    }
  }
  const data = await fetchJson<T>(url);
  await writeFile(cacheFile, JSON.stringify(data, null, 2));
  return data;
}

/** Fetch set listing (cards array has only id/localId/name/image) */
export async function fetchSet(tcgdexId: string): Promise<TcgdexSet> {
  return cachedFetch<TcgdexSet>(`${tcgdexId}_set`, `${BASE_URL}/sets/${tcgdexId}`);
}

/** Fetch full card data */
export async function fetchCard(tcgdexId: string, localId: string): Promise<TcgdexCard> {
  // Try as-is, then zero-padded
  const candidates = [localId];
  const padded = localId.padStart(3, "0");
  if (padded !== localId) candidates.push(padded);

  for (const num of candidates) {
    const cardId = `${tcgdexId}-${num}`;
    try {
      return await cachedFetch<TcgdexCard>(cardId, `${BASE_URL}/cards/${cardId}`, isIncompleteCard);
    } catch (e) {
      if (num !== candidates[candidates.length - 1]) continue;
      throw e;
    }
  }
  throw new Error(`Card not found: ${tcgdexId}-${localId}`);
}

/**
 * Resolve a card's `evolveFrom` by *name* (for cards not in any loaded set —
 * e.g. a Stage 1 a Rare-Candy deck skips). Hits TCGdex's name search, then the
 * matching card's full data. Both calls are disk-cached, so this is a one-time
 * network hit per unknown name. Returns undefined if nothing matches.
 */
export async function fetchCardEvolveFromByName(name: string): Promise<string | undefined> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const list = await cachedFetch<Array<{ id: string; name: string }>>(
    `name-${slug}`,
    `${BASE_URL}/cards?name=${encodeURIComponent(name)}`,
  );
  const match = list.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? list[0];
  if (!match) return undefined;
  const full = await cachedFetch<TcgdexCard>(match.id, `${BASE_URL}/cards/${match.id}`, isIncompleteCard);
  return (full.evolveFrom as string) ?? undefined;
}

/** Fetch all cards in a set (full data for each) */
export async function fetchSetCards(tcgdexId: string): Promise<TcgdexCard[]> {
  const set = await fetchSet(tcgdexId);
  const cards = set.cards ?? [];
  console.log(`Loading ${cards.length} cards from ${set.name ?? tcgdexId}...`);

  const results: TcgdexCard[] = [];
  // Batch in groups of 10 for concurrency
  for (let i = 0; i < cards.length; i += 10) {
    const batch = cards.slice(i, i + 10);
    const fetched = await Promise.all(
      batch.map((c) => fetchCard(tcgdexId, c.localId).catch((e) => {
        console.warn(`  Skipping ${tcgdexId}-${c.localId}: ${e.message}`);
        return null;
      }))
    );
    results.push(...fetched.filter((c): c is TcgdexCard => c !== null));
  }
  console.log(`  Loaded ${results.length} cards`);
  return results;
}
