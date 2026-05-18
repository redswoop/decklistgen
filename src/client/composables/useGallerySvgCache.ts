/** Gallery SVG cache.
 *
 *  Both `GallerySvgThumb.vue` and the gallery's `openPrint()` need to fetch the
 *  rendered SVG for a given card from `/api/pokeproxy/svg/{cardId}`. We cache
 *  by `${cardId}|${cacheBust}` so:
 *    - identical (card, bust) pairs share a single in-flight promise
 *    - bumping `cacheBust` invalidates all prior entries naturally
 *
 *  Errors are returned as a fallback `<span>` string so callers can drop the
 *  result into `v-html` without branching on success vs failure.
 */
const cache = new Map<string, Promise<string>>();

export function getSvg(cardId: string, cacheBust: number): Promise<string> {
  const key = `${cardId}|${cacheBust}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const p = fetch(`/api/pokeproxy/svg/${cardId}?t=${cacheBust}`)
    .then(async (resp) => {
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      return `<span style="color:#666;font-size:12px">Failed: ${msg}</span>`;
    });

  cache.set(key, p);
  return p;
}

/** Read a cached entry without fetching. Used by openPrint() to collect
 *  already-loaded SVGs for the print sheet. */
export function peekSvg(cardId: string, cacheBust: number): Promise<string> | undefined {
  return cache.get(`${cardId}|${cacheBust}`);
}

/** Drop every cached entry. Currently unused but useful if we ever want a
 *  hard reset that isn't tied to a cacheBust value. */
export function clearGallerySvgCache(): void {
  cache.clear();
}
