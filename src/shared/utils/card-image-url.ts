export type CardImageResolution = "high" | "low";

/** Append resolution suffix to a card's base image URL */
export function cardImageUrl(base: string, resolution: CardImageResolution = "high"): string {
  if (!base) return "";
  return `${base}/${resolution}.png`;
}
