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
  "double rare", // SV-era ex cards
];

/** Detect if a card has full-bleed art (artwork spans the entire card).
 *
 * Includes all ex/EX, V/VMAX/VSTAR Pokemon, high-rarity cards,
 * and secret rares (card number above official set count).
 */
export function isFullArt(card: TcgdexCard): boolean {
  const name = card.name ?? "";
  const stage = card.stage ?? "";
  const category = card.category ?? "";

  // All ex/EX Pokemon have full-bleed art
  if (
    category === "Pokemon" &&
    (name.toLowerCase().endsWith(" ex") ||
      stage === "VMAX" ||
      stage === "VSTAR")
  ) {
    return true;
  }

  // V cards
  if (
    category === "Pokemon" &&
    name.endsWith(" V") &&
    !name.endsWith(" IV")
  ) {
    return true;
  }

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
