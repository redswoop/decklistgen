import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { Card } from "../../shared/types/card.js";

/** Format a 0..1 probability as a one-decimal percentage, e.g. 0.1234 -> "12.3%". */
export function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** Thumbnail (low-res) image URL for a hand card. */
export function imgFor(card: Card): string {
  return cardImageUrl(card.imageBase, "low");
}

/** Full-res image URL for the zoom overlay. */
export function zoomImgFor(card: Card): string {
  return cardImageUrl(card.imageBase, "high");
}
