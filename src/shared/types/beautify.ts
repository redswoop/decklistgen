import type { Card } from "./card.js";

export type BeautifyMode = "random" | "best" | "manual";

export interface BeautifyOptions {
  mode: BeautifyMode;
  excludeRarities: string[];
  excludePrintUnfriendly?: boolean;
}

export interface BeautifyPreview {
  name: string;
  currentCards: { cardId: string; count: number }[];
  variants: Card[];
}
