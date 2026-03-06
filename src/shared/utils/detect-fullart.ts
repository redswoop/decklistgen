import type { TcgdexCard } from "../types/card.js";

const FULLART_RARITIES = [
  "illustration rare",
  "special illustration rare",
  "special art rare",
  "hyper rare",
  "art rare",
  "ultra rare",
  "secret rare",
  "amazing rare",
  "rare vmax",
  "rare vstar",
];

/** Ported from pokeproxy.py:573-599 */
export function isFullArt(card: TcgdexCard): boolean {
  const rarity = (card.rarity ?? "").toLowerCase();
  if (FULLART_RARITIES.some((r) => rarity.includes(r))) return true;
  // Card number above official set count
  const official = card.set?.cardCount?.official ?? 999;
  const localId = card.localId ?? "0";
  try {
    if (parseInt(localId, 10) > official) return true;
  } catch {
    // non-numeric localId
  }
  return false;
}
