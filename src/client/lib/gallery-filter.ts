import type { TemplateName } from "../composables/useGalleryCardSource.js";

export type TemplateFilter = "all" | TemplateName;

export const TEMPLATE_NAMES: readonly TemplateName[] = [
  "basic-energy",
  "pokemon-vstar",
  "pokemon-fullart",
  "trainer",
  "pokemon-standard",
];

export interface GalleryFilterOpts {
  templateFilter: TemplateFilter;
  search: string;
}

/** Count how many cards fall into each template bucket. */
export function countByTemplate<T>(
  cards: readonly T[],
  templateOf: (c: T) => TemplateName,
): Record<TemplateName, number> {
  const out = Object.fromEntries(TEMPLATE_NAMES.map((n) => [n, 0])) as Record<TemplateName, number>;
  for (const c of cards) out[templateOf(c)]++;
  return out;
}

/**
 * Narrow the gallery by template bucket and a free-text search over name + id.
 * Pure: takes the cards, the filter options, and a card->template resolver.
 */
export function filterGalleryCards<T extends { name: string; cardId: string }>(
  cards: readonly T[],
  opts: GalleryFilterOpts,
  templateOf: (c: T) => TemplateName,
): T[] {
  let list = cards.slice();
  if (opts.templateFilter !== "all") {
    list = list.filter((c) => templateOf(c) === opts.templateFilter);
  }
  const q = opts.search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.cardId.toLowerCase().includes(q),
    );
  }
  return list;
}
