import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TcgdexCard, TcgdexSet } from "../../shared/types/card.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");
const BASE_URL = "https://api.tcgdex.net/v2/en";
const UA = "DecklistGen/1.0";

async function ensureCache() {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
}

async function cachedFetch<T>(cacheKey: string, url: string): Promise<T> {
  await ensureCache();
  const cacheFile = join(CACHE_DIR, `${cacheKey}.json`);
  if (existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, "utf-8"));
  }
  console.log(`  Fetching: ${url}`);
  const resp = await fetch(url, { headers: { "User-Agent": UA } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const data = await resp.json() as T;
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
      return await cachedFetch<TcgdexCard>(cardId, `${BASE_URL}/cards/${cardId}`);
    } catch (e) {
      if (num !== candidates[candidates.length - 1]) continue;
      throw e;
    }
  }
  throw new Error(`Card not found: ${tcgdexId}-${localId}`);
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
