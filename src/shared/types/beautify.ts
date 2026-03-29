export type BeautifyMode = "diverse" | "best";

export interface BeautifyOptions {
  mode: BeautifyMode;
  excludeRarities: string[];
  excludePrintUnfriendly?: boolean;
}
